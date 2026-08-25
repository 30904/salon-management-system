import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { arnavApi, preciousApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { fetchPackageMasters } from "../../api/packageMasterApi.js";
import { formatInr } from "../../utils/earningsFormat.js";    
import { BILLING_HANDOFF_PARAM } from "../../utils/billingHandoff.js";
import {
  buildPackageCreditUsedWhatsAppUrl,
  buildRedemptionSummariesFromCart,
  openPackageCreditUsedWhatsApp,
} from "../../utils/whatsappPackage.js";
import PaymentSplitModal from "../../components/billing/PaymentSplitModal.jsx";

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function parseDiscountPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

function combinedDiscountPercent(manualPercent, typePercent) {
  return Math.min(100, parseDiscountPercent(manualPercent) + parseDiscountPercent(typePercent));
}

function isDiscountableCartItem(item) {
  if (item?._is_redeemed_pkg_line) return false;
  return Number(item?.unit_price || 0) * Number(item?.quantity || 0) > 0;
}

function firstPositivePrice(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function getPosUnitPrice(item, type) {
  if (type === "service") {
    return firstPositivePrice(item?.price, item?.default_price);
  }
  if (type === "product") {
    return firstPositivePrice(
      item?.sale_price,
      item?.selling_price,
      item?.default_retail_price,
      item?.price,
      item?.purchase_price,
      299
    );
  }
  return firstPositivePrice(item?.price);
}

function isWalletPackage(pkg) {
  const master = pkg?.package_master || pkg?.package_master_id;
  return master?.type === "amount_wallet";
}

function getLinePreTaxTotal(item, lineDiscountByCartId = {}) {
  const lineTotalRaw = Number(item.unit_price || 0) * Number(item.quantity || 0);
  const lineDiscount =
    Number(item.discount_amount || 0) + Number(lineDiscountByCartId[item.cart_id] || 0);
  return Math.max(0, roundMoney(lineTotalRaw - lineDiscount));
}

function getRemainingWalletBalance(
  pkgId,
  activePackages,
  cartItems,
  lineDiscountByCartId,
  stopBeforeCartId = null
) {
  const pkg = activePackages.find((entry) => String(entry._id || entry.id) === String(pkgId));
  let remaining = Number(pkg?.wallet_balance || 0);

  for (const item of cartItems) {
    if (stopBeforeCartId && item.cart_id === stopBeforeCartId) break;
    if (item._wallet_redeem && String(item.package_redemption_id) === String(pkgId)) {
      const lineTotal = getLinePreTaxTotal(item, lineDiscountByCartId);
      remaining -= Math.min(lineTotal, remaining);
    }
  }

  return Math.max(0, roundMoney(remaining));
}

function computeWalletDeductionForLine(
  lineItem,
  activePackages,
  cartItems,
  lineDiscountByCartId
) {
  if (!lineItem?._wallet_redeem || !lineItem.package_redemption_id) return 0;
  const pkgId = String(lineItem.package_redemption_id);
  const remainingBefore = getRemainingWalletBalance(
    pkgId,
    activePackages,
    cartItems,
    lineDiscountByCartId,
    lineItem.cart_id
  );
  const lineTotal = getLinePreTaxTotal(lineItem, lineDiscountByCartId);
  return Math.min(lineTotal, remainingBefore);
}

/** Spread a bill-level % across paid cart lines (not ₹0 package redemptions). */
function allocatePercentDiscount(cartItems, percentInput) {
  const percent = parseDiscountPercent(percentInput);
  const discounts = {};
  if (percent <= 0) return discounts;

  const eligible = (cartItems || []).filter(isDiscountableCartItem);
  const subtotal = eligible.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
    0
  );
  if (subtotal <= 0) return discounts;

  const targetTotal = roundMoney((subtotal * percent) / 100);
  let allocated = 0;

  eligible.forEach((item, index) => {
    const lineValue = Number(item.unit_price) * Number(item.quantity);
    const share =
      index === eligible.length - 1
        ? roundMoney(targetTotal - allocated)
        : roundMoney((lineValue * percent) / 100);
    const amount = Math.max(0, Math.min(lineValue, share));
    discounts[item.cart_id] = amount;
    allocated += amount;
  });

  return discounts;
}

export default function PosScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get(BILLING_HANDOFF_PARAM);
  const bookingPrefilledRef = useRef(false);
  // Catalog items state
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState(null);

  const [activeTab, setActiveTab] = useState("services"); // "services" | "products" | "packages" | "all"
  const [activeServiceCategory, setActiveServiceCategory] = useState("ALL"); // "ALL" | "FEMALE SERVICES" | "MALE SERVICES" | "NAIL SERVICES"
  const [searchQuery, setSearchQuery] = useState("");
  const [isGroupedView, setIsGroupedView] = useState(false);

  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null = walk-in
  const [customerActivePackages, setCustomerActivePackages] = useState([]);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Cart / Line Items state
  const [cartItems, setCartItems] = useState([]);
  const [billDiscountPercent, setBillDiscountPercent] = useState("");
  const [selectedDiscountId, setSelectedDiscountId] = useState("");
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [lastPackageRedemptions, setLastPackageRedemptions] = useState([]);

  // Checkout states
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [completedInvoice, setCompletedInvoice] = useState(null); // for celebration modal

  const [bookingHandoff, setBookingHandoff] = useState(null);
  const [bookingHandoffError, setBookingHandoffError] = useState(null);
  const [bookingHandoffLoading, setBookingHandoffLoading] = useState(false);

  // Load initial catalog & staff
  useEffect(() => {
    async function loadAll() {
      setLoadingCatalog(true);
      setCatalogError(null);
      try {
        const [srvRes, prodRes, pkgRes, staffRes] = await Promise.all([
          arnavApi.listServices({ is_active: true }).catch(() => ({ data: [] })),
          arnavApi.listProducts({ is_active: true }).catch(() => ({ data: [] })),
          fetchPackageMasters({ is_active: true }).catch(() => ({ data: [] })),
          fetchStaffProfiles({ is_active: true }).catch(() => ({ data: [] })),
        ]);

        setServices(srvRes?.data || []);
        setProducts(prodRes?.data || []);
        setPackages(pkgRes?.data || []);
        setStaffList(staffRes?.data || []);
      } catch (err) {
        setCatalogError("Failed to load catalog data. Please refresh.");
        console.error(err);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadAll();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscounts() {
      try {
        const response = await arnavApi.listDiscounts({
          is_active: true,
          available_now: true,
        });
        if (cancelled) return;
        const list = response?.data || [];
        setAvailableDiscounts(list);
        setSelectedDiscountId((current) =>
          current && list.some((item) => String(item.id) === String(current)) ? current : ""
        );
      } catch (err) {
        if (!cancelled) {
          setAvailableDiscounts([]);
        }
      }
    }

    loadDiscounts();
    const timer = setInterval(loadDiscounts, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!bookingId || bookingPrefilledRef.current || loadingCatalog) {
      return undefined;
    }

    let cancelled = false;

    async function loadBookingHandoff() {
      setBookingHandoffLoading(true);
      setBookingHandoffError(null);

      try {
        const response = await arnavApi.getBooking(bookingId);

        if (!response.success) {
          throw new Error(response.message || "Failed to load booking");
        }

        const booking = response.data;

        if (cancelled) {
          return;
        }

        if (booking.status !== "completed") {
          setBookingHandoffError(
            `This booking is "${booking.status}". Complete the appointment before creating an invoice.`
          );
        }

        const customer = booking.customer || {
          id: booking.customer_id,
          name: booking.customer_name,
          phone: booking.customer_phone,
        };

        const customerId = customer?.id || booking.customer_id;

        if (customerId) {
          setSelectedCustomer({
            id: customerId,
            name: customer.name || booking.customer_name || "Customer",
            phone: customer.phone || booking.customer_phone || "",
          });
        }

        const stylistId =
          booking.stylist_id || booking.stylist?.id || booking.staff_id || "";

        const servicesOnBooking = Array.isArray(booking.services)
          ? booking.services
          : [];

        if (servicesOnBooking.length > 0) {
          setCartItems(
            servicesOnBooking.map((service, index) => ({
              cart_id: `booking_${booking.id}_${service.id}_${index}`,
              item_id: service.id,
              item_type: "service",
              item_name: service.name,
              staff_id: stylistId,
              quantity: 1,
              unit_price: Number(service.price || 0),
              discount_amount: 0,
              package_redemption_id: null,
            }))
          );
        }

        setInvoiceNotes(booking.notes || "");

        setBookingHandoff(booking);
        setActiveTab("services");
        bookingPrefilledRef.current = true;
      } catch (err) {
        if (!cancelled) {
          setBookingHandoffError(
            err.response?.data?.message || err.message || "Could not load booking"
          );
        }
      } finally {
        if (!cancelled) {
          setBookingHandoffLoading(false);
        }
      }
    }

    loadBookingHandoff();

    return () => {
      cancelled = true;
    };
  }, [bookingId, loadingCatalog]);

  // When selected customer changes, load their active packages for redemption toggle
  useEffect(() => {
    async function loadCustPackages() {
      if (!selectedCustomer?._id && !selectedCustomer?.id) {
        setCustomerActivePackages([]);
        return;
      }
      const custId = selectedCustomer._id || selectedCustomer.id;
      const res = await preciousApi.fetchCustomerActivePackages(custId);
      if (res?.success || Array.isArray(res?.data)) {
        setCustomerActivePackages(res.data || []);
      }
    }
    loadCustPackages();
  }, [selectedCustomer]);

  // Customer search handler
  const handleSearchCustomer = async (query) => {
    setCustomerSearchQuery(query);
    if (!query || query.trim().length < 2) {
      setCustomerSearchResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const res = await arnavApi.searchCustomers({ q: query.trim() });
      setCustomerSearchResults(res?.data || []);
    } catch (err) {
      console.error("Customer search error:", err);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleQuickCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    try {
      const res = await arnavApi.findOrCreateCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || undefined,
      });
      if (res?.data) {
        setSelectedCustomer(res.data);
        setIsCustomerSearchOpen(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error creating customer");
    }
  };

  // Add Item to Cart
  const addToCart = (item, type) => {
    const itemId = item._id || item.id;
    // Check if item is already in cart with exact same settings
    const existingIdx = cartItems.findIndex(
      (ci) => ci.item_id === itemId && ci.item_type === type && !ci.package_redemption_id
    );

    if (existingIdx !== -1 && type !== "package") {
      // Increment quantity
      const updated = [...cartItems];
      const curQty = updated[existingIdx].quantity || 1;
      // Pre-check stock if product
      if (type === "product" && curQty >= (item.current_stock || 0)) {
        alert(`Cannot add more: only ${item.current_stock} unit(s) available in stock.`);
        return;
      }
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: curQty + 1,
      };
      setCartItems(updated);
    } else {
      // If product check initial stock
      if (type === "product" && (item.current_stock || 0) <= 0) {
        alert("This product is currently Out of Stock.");
        return;
      }

      // Default staff assigned: pick first active stylist or null if none
      const defaultStaff = staffList.length > 0 ? staffList[0]._id || staffList[0].id : "";

      const price = getPosUnitPrice(item, type);

      setCartItems([
        ...cartItems,
        {
          cart_id: `${itemId}_${Date.now()}_${Math.random()}`,
          item_id: itemId,
          item_type: type, // "service" | "product" | "package"
          item_name: item.name,
          staff_id: defaultStaff,
          quantity: 1,
          unit_price: price,
          tax_rate: type === "package" ? 0 : 18,
          discount_amount: 0,
          package_redemption_id: null, // assigned when toggled
          max_stock: type === "product" ? item.current_stock : null,
        },
      ]);
    }
  };

  // Update Cart Item
  const updateCartItem = (cartId, updates) => {
    setCartItems((prev) =>
      prev.map((ci) => {
        if (ci.cart_id !== cartId) return ci;
        return { ...ci, ...updates };
      })
    );
  };

  // Remove Cart Item
  const removeCartItem = (cartId) => {
    setCartItems((prev) => prev.filter((ci) => ci.cart_id !== cartId));
  };

  // Check if a line item can be redeemed against one of the customer's active packages
  const getEligiblePackageForLine = (lineItem) => {
    if (lineItem.item_type === "package") return null;
    if (customerActivePackages.length === 0) return null;

    const walletPkg = customerActivePackages.find(
      (pkg) => isWalletPackage(pkg) && Number(pkg.wallet_balance) > 0
    );
    if (walletPkg) return walletPkg;

    let eligible = customerActivePackages.find((pkg) => {
      if (isWalletPackage(pkg)) return false;
      const inc = pkg.package_master?.included_services || [];
      if (inc.length === 0) return false;
      const lineIdString = String(lineItem.item_id);
      const lineName = (lineItem.item_name || "").toLowerCase();
      
      return inc.some((s) => {
        if (typeof s === "string") {
          return s === lineIdString || s.toLowerCase() === lineName;
        }
        if (s && typeof s === "object") {
          if (s._id && String(s._id) === lineIdString) return true;
          if (s.id && String(s.id) === lineIdString) return true;
          if (s.service_name) {
            const definedName = s.service_name.toLowerCase().trim();
            const trimmedLineName = lineName.trim();
            return definedName.includes(trimmedLineName) || trimmedLineName.includes(definedName);
          }
        }
        return false;
      });
    });

    // If no exact match is found, just return the first active package.
    // The user explicitly requested to allow overriding and redeeming credits 
    // against any service or product, even if not strictly in the package.
    if (!eligible) {
      eligible = customerActivePackages.find((pkg) => !isWalletPackage(pkg));
    }

    return eligible;
  };

  // Filter catalog items based on tab & search query
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let combined = [];
    if (activeTab === "all" || activeTab === "services") {
      let filteredServices = services;
      if (activeTab === "services" && activeServiceCategory !== "ALL") {
        filteredServices = services.filter((s) => s.category?.name === activeServiceCategory);
      }
      combined = combined.concat(
        filteredServices.map((s) => ({ ...s, _type: "service" }))
      );
    }
    if (activeTab === "all" || activeTab === "products") {
      combined = combined.concat(
        products.map((p) => ({ ...p, _type: "product" }))
      );
    }
    if (activeTab === "all" || activeTab === "packages") {
      combined = combined.concat(
        packages.map((pkg) => ({ ...pkg, _type: "package" }))
      );
    }

    if (!q) return combined;
    return combined.filter((it) => {
      const matchName = (it.name || "").toLowerCase().includes(q);
      const matchCode = (it.code || it.sku || "").toLowerCase().includes(q);
      return matchName || matchCode;
    });
  }, [activeTab, activeServiceCategory, searchQuery, services, products, packages]);

  const selectedDiscountType = useMemo(
    () => availableDiscounts.find((item) => String(item.id) === String(selectedDiscountId)) || null,
    [availableDiscounts, selectedDiscountId]
  );
  const typeDiscountPercent = parseDiscountPercent(selectedDiscountType?.percent);
  const appliedDiscountPercent = combinedDiscountPercent(billDiscountPercent, typeDiscountPercent);

  const lineDiscountByCartId = useMemo(
    () => allocatePercentDiscount(cartItems, appliedDiscountPercent),
    [cartItems, appliedDiscountPercent]
  );

  // Compute subtotal & grand total
  const billSummary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let estimatedTax = 0;
    cartItems.forEach((ci) => {
      const lineTotalRaw = Number(ci.unit_price || 0) * Number(ci.quantity || 0);
      const lineDiscount =
        Number(ci.discount_amount || 0) + Number(lineDiscountByCartId[ci.cart_id] || 0);
      const walletDeduction = computeWalletDeductionForLine(
        ci,
        customerActivePackages,
        cartItems,
        lineDiscountByCartId
      );
      subtotal += lineTotalRaw;
      totalDiscount += lineDiscount + walletDeduction;
      const taxableLine = Math.max(0, lineTotalRaw - lineDiscount - walletDeduction);
      const taxRate =
        ci.tax_rate !== undefined
          ? Number(ci.tax_rate || 0)
          : ci.item_type === "package" || walletDeduction > 0
            ? 0
            : 18;
      estimatedTax += (taxableLine * taxRate) / 100;
    });
    totalDiscount = roundMoney(totalDiscount);
    estimatedTax = roundMoney(estimatedTax);
    const taxable = roundMoney(Math.max(0, subtotal - totalDiscount));
    const grandTotal = roundMoney(taxable + estimatedTax);
    return { subtotal, totalDiscount, taxable, estimatedTax, grandTotal };
  }, [cartItems, lineDiscountByCartId, customerActivePackages]);

  const buildInvoiceNotes = () => {
    const parts = [];

    if (bookingHandoff?.id) {
      parts.push(`Booking ref: ${bookingHandoff.id}`);
    }

    const trimmedNotes = invoiceNotes.trim();
    if (trimmedNotes) {
      parts.push(trimmedNotes);
    }

    return parts.length > 0 ? parts.join(" · ") : undefined;
  };

  // Handle Checkout
  const handleCheckout = async (paymentMode, splitPaymentsArray = null) => {
    setCheckoutError(null);
    if (cartItems.length === 0) {
      setCheckoutError("Cart is empty. Please add items to bill.");
      return;
    }

    // Verify all lines have staff_id
    const missingStaff = cartItems.some((ci) => !ci.staff_id);
    if (missingStaff) {
      setCheckoutError("Please assign a Stylist / Staff member for every line item in the bill.");
      return;
    }

    setIsSubmitting(true);
    // Open blank tab synchronously on click so popup blockers allow WhatsApp after await.
    const pendingRedemptions = buildRedemptionSummariesFromCart({
      cartItems,
      activePackages: customerActivePackages,
      customer: selectedCustomer,
    });
    let waWindow = null;
    if (pendingRedemptions.length > 0 && selectedCustomer?.phone) {
      waWindow = window.open("about:blank", "_blank");
    }

    try {
      const payload = {
        customer_id: selectedCustomer ? selectedCustomer._id || selectedCustomer.id : undefined,
        customer_name: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        customer_phone: selectedCustomer ? selectedCustomer.phone : undefined,
        payment_mode: paymentMode,
        payment_status: "paid",
        split_payments: splitPaymentsArray || undefined,
        notes: buildInvoiceNotes(),
        discount_master_id: selectedDiscountId || undefined,
        discount_percent: parseDiscountPercent(billDiscountPercent),
        line_items: cartItems.map((ci) => {
          return {
            item_type: ci.item_type,
            item_id: ci.item_id,
            item_name: ci.item_name,
            staff_id: ci.staff_id,
            quantity: ci.quantity,
            // The redeemed package line already has unit_price=0, so no discount needed
            unit_price: ci.unit_price,
            tax_rate: ci.tax_rate !== undefined ? ci.tax_rate : (ci.item_type === "package" ? 0 : 18),
            discount_amount: roundMoney(
              Number(ci.discount_amount || 0) + Number(lineDiscountByCartId[ci.cart_id] || 0)
            ),
            // Only the redeemed package ₹0 line carries package_redemption_id
            package_redemption_id:
              ci._is_redeemed_pkg_line || ci._wallet_redeem
                ? ci.package_redemption_id || undefined
                : undefined,
          };
        }),
      };

      const res = await preciousApi.createInvoice(payload);
      if (res?.success || res?.data) {
        const redemptionSummaries = buildRedemptionSummariesFromCart({
          cartItems,
          activePackages: customerActivePackages,
          customer: selectedCustomer,
        });

        setLastPackageRedemptions(redemptionSummaries);
        setCompletedInvoice(res.data || res);
        setIsSplitModalOpen(false);
        // Reset cart
        setCartItems([]);
        setBillDiscountPercent("");
        setSelectedDiscountId("");
        setInvoiceNotes("");

        if (redemptionSummaries.length > 0 && selectedCustomer?.phone) {
          const waUrl = buildPackageCreditUsedWhatsAppUrl(redemptionSummaries[0]);
          if (waUrl && waWindow && !waWindow.closed) {
            waWindow.location.href = waUrl;
          } else if (waWindow && !waWindow.closed) {
            waWindow.close();
          } else if (waUrl) {
            openPackageCreditUsedWhatsApp(redemptionSummaries[0]);
          }
        } else if (waWindow && !waWindow.closed) {
          waWindow.close();
        }
        
        // Re-fetch customer packages to update the badge if a package was just bought
        if (selectedCustomer) {
          const custId = selectedCustomer._id || selectedCustomer.id;
          preciousApi.fetchCustomerActivePackages(custId).then(pkgRes => {
            if (pkgRes?.success || Array.isArray(pkgRes?.data)) {
              setCustomerActivePackages(pkgRes.data || []);
            }
          }).catch(console.error);
        }
      } else {
        if (waWindow && !waWindow.closed) waWindow.close();
        throw new Error(res?.message || "Failed to create invoice");
      }
    } catch (err) {
      if (waWindow && !waWindow.closed) waWindow.close();
      const msg = err.response?.data?.message || err.message || "Error creating invoice";
      setCheckoutError(msg);
      console.error("Billing error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page pos-screen">
      {/* ── POS Header ──────────────────────────────────────────────────────── */}
      <header className="pos-header">
        <div className="pos-header__left">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <span className="pos-badge">TERMINAL 1</span>
            <button
              type="button"
              className="pos-header-link-btn"
              onClick={() => navigate("/invoices")}
              title="View all past GST bills, void records & print duplicates"
            >
              Invoices History / Audit →
            </button>
          </div>
          <h1>Touchscreen POS & Billing</h1>
        </div>

        {/* Customer Selector Bar */}
        <div className="pos-header__customer">
          <div className="pos-customer-pill" onClick={() => setIsCustomerSearchOpen(true)}>
            <div className="pos-customer-info">
              <span className="pos-customer-label">Customer</span>
              <strong>{selectedCustomer ? selectedCustomer.name : "Walk-in Customer"}</strong>
              {selectedCustomer?.phone && <small>{selectedCustomer.phone}</small>}
            </div>
            <button type="button" className="pos-customer-change-btn">
              {selectedCustomer ? "Change / Packages" : "+ Select Customer"}
            </button>
          </div>

          {customerActivePackages.length > 0 && (
            <div className="pos-active-pkg-badge" title="Packages available to redeem credits against billing items">
              {customerActivePackages.length} Active Package(s)
            </div>
          )}
        </div>
      </header>

      {bookingId && (
        <div className="pos-booking-handoff-banner">
          <div>
            <strong>Invoice from completed booking</strong>
            {bookingHandoffLoading && (
              <p className="pos-booking-handoff-banner__meta">Loading booking details…</p>
            )}
            {!bookingHandoffLoading && bookingHandoff && (
              <p className="pos-booking-handoff-banner__meta">
                {bookingHandoff.customer_name || bookingHandoff.customer?.name}
                {bookingHandoff.service_label
                  ? ` · ${bookingHandoff.service_label}`
                  : ""}
                {bookingHandoff.staff_name ? ` · ${bookingHandoff.staff_name}` : ""}
              </p>
            )}
            {bookingHandoffError && (
              <p className="pos-booking-handoff-banner__error">{bookingHandoffError}</p>
            )}
          </div>
          <Link to="/bookings" className="user-secondary-btn">
            Back to bookings
          </Link>
        </div>
      )}

      {/* ── Main Layout: Catalog vs Bill Cart ──────────────────────────────── */}
      <div className="pos-main-grid">
        {/* Left Side: Catalog */}
        <section className="pos-catalog-panel">
          {/* Category Tabs */}
          <div className="pos-tabs">
            <button
              type="button"
              className={`pos-tab ${activeTab === "services" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("services");
                setActiveServiceCategory("ALL");
              }}
            >
              Services ({services.length})
            </button>
            <button
              type="button"
              className={`pos-tab ${activeTab === "products" ? "active" : ""}`}
              onClick={() => setActiveTab("products")}
            >
              Products ({products.length})
            </button>
            <button
              type="button"
              className={`pos-tab ${activeTab === "packages" ? "active" : ""}`}
              onClick={() => setActiveTab("packages")}
            >
              Packages ({packages.length})
            </button>
            <button
              type="button"
              className={`pos-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All ({services.length + products.length + packages.length})
            </button>
            {customerActivePackages.length > 0 && (
              <button
                type="button"
                className={`pos-tab ${activeTab === "active_packages" ? "active" : ""}`}
                onClick={() => setActiveTab("active_packages")}
              >
                Active Packages ({customerActivePackages.length})
              </button>
            )}
          </div>

          {activeTab === "services" && (
            <div className="pos-tabs" style={{ marginBottom: '16px', gap: '8px' }}>
              <button
                type="button"
                className={`pos-tab ${activeServiceCategory === "FEMALE SERVICES" ? "active" : ""}`}
                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                onClick={() => setActiveServiceCategory("FEMALE SERVICES")}
              >
                Female Services
              </button>
              <button
                type="button"
                className={`pos-tab ${activeServiceCategory === "MALE SERVICES" ? "active" : ""}`}
                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                onClick={() => setActiveServiceCategory("MALE SERVICES")}
              >
                Male Services
              </button>
              <button
                type="button"
                className={`pos-tab ${activeServiceCategory === "NAIL SERVICES" ? "active" : ""}`}
                style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                onClick={() => setActiveServiceCategory("NAIL SERVICES")}
              >
                Nail Services
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div className="pos-search-bar" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* <span>🔎</span> */}
            <input
              style={{ flex: 1 }}
              type="text"
              placeholder="Search by name, service code, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="pos-clear-search">
                ✕
              </button>
            )}
          </div>

          {/* Items Grid */}
          {loadingCatalog ? (
            <div className="pos-catalog-loading">Loading catalog items & active staff profiles…</div>
          ) : catalogError ? (
            <div className="status-error">{catalogError}</div>
          ) : activeTab === "active_packages" ? (
            <div className="pos-items-grid" style={{ gridTemplateColumns: "1fr" }}>
              {Object.values(
                customerActivePackages.reduce((acc, pkg) => {
                  const masterId = pkg.package_master_id || pkg._id;
                  if (!acc[masterId]) {
                    acc[masterId] = {
                      ...pkg,
                      total_credits_remaining: 0,
                      aggregated_total_credits: 0,
                      total_wallet_balance: 0,
                    };
                  }
                  if (isWalletPackage(pkg)) {
                    acc[masterId].total_wallet_balance += Number(pkg.wallet_balance || 0);
                  } else {
                    acc[masterId].total_credits_remaining += pkg.credits_remaining || 0;
                    acc[masterId].aggregated_total_credits += pkg.package_master?.credit_count || 0;
                  }
                  return acc;
                }, {})
              ).map((pkg) => (
                <div key={pkg._id} style={{ background: '#ffffff', border: '1px solid #5eead4', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '4px', color: '#0f172a' }}>
                      {isWalletPackage(pkg) ? "Wallet" : "Package"}({pkg.package_master?.name || 'Unknown'})
                    </strong>
                  </div>
                  <div style={{ textAlign: 'right', background: '#ecfdf5', padding: '8px 16px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                    <div className="pos-active-pkg-card__body">
                      {isWalletPackage(pkg) ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px' }}>
                            <strong style={{ fontSize: '1.4rem', color: '#047857', lineHeight: 1 }}>
                              {formatInr(pkg.total_wallet_balance || pkg.wallet_balance || 0)}
                            </strong>
                          </div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px', fontWeight: 700 }}>
                            Wallet Balance
                          </span>
                        </>
                      ) : pkg.total_credits_remaining <= 0 ? (
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#dc2626', display: 'flex', alignItems: 'center' }}>
                          Credits Expired
                        </span>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '4px' }}>
                            <strong style={{ fontSize: '1.4rem', color: '#047857', lineHeight: 1 }}>{pkg.total_credits_remaining}</strong>
                            <span style={{ fontSize: '0.9rem', color: '#059669', fontWeight: 600 }}>
                              {pkg.aggregated_total_credits > 0 ? `/ ${pkg.aggregated_total_credits}` : ''}
                            </span>
                          </div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px', fontWeight: 700 }}>
                            Credits Left
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="pos-catalog-empty">No matching catalog items found for "{searchQuery}".</div>
          ) : isGroupedView ? (
            <div className="pos-catalog-groups">
              {Object.entries(
                filteredCatalog.reduce((groups, item) => {
                  let groupName = "Other";
                  if (item._type === "service") {
                    groupName = item.category?.name || "Uncategorized Services";
                  } else if (item._type === "product") {
                    groupName = "Products";
                  } else if (item._type === "package") {
                    groupName = "Packages";
                  }
                  if (!groups[groupName]) groups[groupName] = [];
                  groups[groupName].push(item);
                  return groups;
                }, {})
              ).map(([groupName, items]) => (
                <div key={groupName} className="pos-catalog-group" style={{ marginBottom: "32px" }}>
                  <h3 style={{ marginBottom: "16px", color: "#1e293b", fontSize: "1.2rem", fontWeight: "700", borderBottom: "2px solid #e2e8f0", paddingBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{groupName}</h3>
                  <div className="pos-items-grid">
                    {items.map((item) => {
                      const type = item._type;
                      const itemId = item._id || item.id;
                      const price = getPosUnitPrice(item, type);
                      const isOutOfStock = type === "product" && (item.current_stock || 0) <= 0;

                      return (
                        <div
                          key={`${type}_${itemId}`}
                          className={`pos-item-card ${isOutOfStock ? "out-of-stock" : ""}`}
                          onClick={() => !isOutOfStock && addToCart(item, type)}
                        >
                          <div className="pos-item-card__top">
                            <span className={`pos-item-type-badge ${type}`}>
                              {type === "service" ? "Service" : type === "product" ? "Product" : "Package"}
                            </span>
                            {type === "product" && (
                              <span className={`product-stock-pill ${isOutOfStock ? "low" : "ok"}`}>
                                {isOutOfStock ? "Out of Stock" : `${item.current_stock} in stock`}
                              </span>
                            )}
                          </div>

                          <h3 className="pos-item-card__name">{item.name}</h3>

                          <div className="pos-item-card__bottom">
                            <div className="pos-item-card__meta">
                              {type === "service" && <span>{item.duration_minutes || 30} mins</span>}
                              {type === "product" && <span>SKU: {item.sku || "N/A"}</span>}
                              {type === "package" && <span>{item.credit_count || 0} credits</span>}
                            </div>
                            <div className="pos-item-card__price">{formatInr(price || 0)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pos-items-grid">
              {filteredCatalog.map((item) => {
                const type = item._type;
                const itemId = item._id || item.id;
                const price = getPosUnitPrice(item, type);
                const isOutOfStock = type === "product" && (item.current_stock || 0) <= 0;

                return (
                  <div
                    key={`${type}_${itemId}`}
                    className={`pos-item-card ${isOutOfStock ? "out-of-stock" : ""}`}
                    onClick={() => !isOutOfStock && addToCart(item, type)}
                  >
                    <div className="pos-item-card__top">
                      <span className={`pos-item-type-badge ${type}`}>
                        {type === "service" ? "Service" : type === "product" ? "Product" : "Package"}
                      </span>
                      {type === "product" && (
                        <span className={`product-stock-pill ${isOutOfStock ? "low" : "ok"}`}>
                          {isOutOfStock ? "Out of Stock" : `${item.current_stock} in stock`}
                        </span>
                      )}
                    </div>

                    <h3 className="pos-item-card__name">{item.name}</h3>

                    <div className="pos-item-card__bottom">
                      <div className="pos-item-card__meta">
                        {type === "service" && <span>{item.duration_minutes || 30} mins</span>}
                        {type === "product" && <span>SKU: {item.sku || "N/A"}</span>}
                        {type === "package" && <span>{item.credit_count || 0} credits</span>}
                      </div>
                      <div className="pos-item-card__price">{formatInr(price || 0)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Side: Current Bill / Cart */}
        <aside className="pos-cart-panel">
          <div className="pos-cart-header">
            <div>
              <h2>Current Bill</h2>
              <span>{cartItems.length} line item(s)</span>
            </div>
            {cartItems.length > 0 && (
              <button type="button" className="pos-cart-clear-btn" onClick={() => setCartItems([])}>
                🧹 Clear Bill
              </button>
            )}
          </div>

          {checkoutError && <div className="pos-checkout-error">{checkoutError}</div>}

          {/* Cart Items List */}
          <div className="pos-cart-items">
            {cartItems.length === 0 ? (
              <div className="pos-cart-empty">
                <span>🛒</span>
                <p>No items added yet.</p>
                <small>Tap services, products, or packages on the left to add them to this bill.</small>
              </div>
            ) : (
              cartItems.map((ci, idx) => {
                const eligiblePkg = getEligiblePackageForLine(ci);
                const isWalletEligible = eligiblePkg && isWalletPackage(eligiblePkg);
                const isCreditEligible = eligiblePkg && !isWalletPackage(eligiblePkg);
                const isRedeemed = Boolean(ci.package_redemption_id);
                const walletDeduction = computeWalletDeductionForLine(
                  ci,
                  customerActivePackages,
                  cartItems,
                  lineDiscountByCartId
                );
                const linePayable = Math.max(
                  0,
                  getLinePreTaxTotal(ci, lineDiscountByCartId) - walletDeduction
                );

                let remainingCreditsForLine = eligiblePkg?.credits_remaining || 0;
                if (isCreditEligible && eligiblePkg) {
                  const pkgId = String(eligiblePkg._id || eligiblePkg.id);
                  const redeemedInCart = cartItems
                    .filter(
                      (item) =>
                        item._is_redeemed_pkg_line &&
                        String(item.package_redemption_id) === pkgId
                    )
                    .reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
                  remainingCreditsForLine = Math.max(
                    0,
                    (eligiblePkg.credits_remaining || 0) - redeemedInCart
                  );
                }

                let walletRemainingAfter = 0;
                if (isWalletEligible && eligiblePkg) {
                  const pkgId = String(eligiblePkg._id || eligiblePkg.id);
                  walletRemainingAfter = getRemainingWalletBalance(
                    pkgId,
                    customerActivePackages,
                    cartItems,
                    lineDiscountByCartId
                  );
                }

                return (
                  <div key={ci.cart_id} className="pos-cart-row">
                    <div className="pos-cart-row__top">
                      <div>
                        <span className="pos-cart-row__type">{ci.item_type.toUpperCase()}</span>
                        <strong className="pos-cart-row__name">{ci.item_name}</strong>
                      </div>
                      <button
                        type="button"
                        className="pos-cart-row__delete"
                        onClick={() => removeCartItem(ci.cart_id)}
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Quantity & Unit Price */}
                    <div className="pos-cart-row__middle">
                      <div className="pos-qty-control">
                        <button
                          type="button"
                          onClick={() => {
                            if (ci.quantity > 1) updateCartItem(ci.cart_id, { quantity: ci.quantity - 1 });
                            else removeCartItem(ci.cart_id);
                          }}
                        >
                          −
                        </button>
                        <span>{ci.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (ci.item_type === "product" && ci.quantity >= (ci.max_stock || 0)) {
                              alert(`Cannot exceed available stock (${ci.max_stock}).`);
                              return;
                            }
                            updateCartItem(ci.cart_id, { quantity: ci.quantity + 1 });
                          }}
                        >
                          +
                        </button>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div className="pos-item-price-calc">
                          {ci._is_redeemed_pkg_line ? (
                            <strong style={{ color: "#059669" }}>₹0.00 — Package Redeemed</strong>
                          ) : ci._wallet_redeem && walletDeduction > 0 ? (
                            <div style={{ textAlign: "right" }}>
                              <small style={{ color: "#64748b", textDecoration: "line-through" }}>
                                {formatInr(ci.unit_price * ci.quantity)}
                              </small>
                              <strong style={{ color: "#059669", display: "block" }}>
                                {formatInr(linePayable)} payable
                              </strong>
                              <small style={{ color: "#047857" }}>
                                Wallet −{formatInr(walletDeduction)}
                              </small>
                            </div>
                          ) : (
                            <>
                              <small>₹{ci.unit_price} x {ci.quantity}</small>
                              <strong>{formatInr(ci.unit_price * ci.quantity)}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Per-Line Staff Assignment & Package Redemption Toggle */}
                    <div className="pos-cart-row__bottom">
                      <div className={`pos-staff-selector ${!ci.staff_id ? "required-warning" : ""}`}>
                        <span>Assign Staff *</span>
                        <select
                          value={ci.staff_id || ""}
                          onChange={(e) => updateCartItem(ci.cart_id, { staff_id: e.target.value })}
                        >
                          <option value="">-- Select Stylist / Staff --</option>
                          {staffList.map((st) => (
                            <option key={st._id || st.id} value={st._id || st.id}>
                              {st.user?.name ||
                                st.display_name ||
                                st.first_name ||
                                st.designation ||
                                st.phone ||
                                `Staff #${st._id || st.id}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Package credit redeem — adds the availed package as a ₹0 line */}
                      {isCreditEligible && ci.item_type !== "package" && (
                        <button
                          type="button"
                          className={`pos-pkg-toggle-btn ${ci._paired_pkg_cart_id ? "active" : ""}`}
                          onClick={() => {
                            const alreadyPaired = ci._paired_pkg_cart_id;
                            if (alreadyPaired) {
                              setCartItems((prev) =>
                                prev
                                  .filter((x) => x.cart_id !== alreadyPaired)
                                  .map((x) =>
                                    x.cart_id === ci.cart_id
                                      ? { ...x, _paired_pkg_cart_id: null, package_redemption_id: null }
                                      : x
                                  )
                              );
                            } else {
                              if (remainingCreditsForLine <= 0) {
                                alert("No more credits available in this package.");
                                return;
                              }
                              const newPkgCartId = `pkg_${eligiblePkg._id || eligiblePkg.id}_${Date.now()}`;
                              const defaultStaff = staffList.length > 0 ? staffList[0]._id || staffList[0].id : "";
                              const pkgLine = {
                                cart_id: newPkgCartId,
                                item_id: eligiblePkg._id || eligiblePkg.id,
                                item_type: "package",
                                item_name: eligiblePkg.package_master?.name || "Package",
                                staff_id: ci.staff_id || defaultStaff,
                                quantity: 1,
                                unit_price: 0,
                                tax_rate: 0,
                                discount_amount: 0,
                                package_redemption_id: eligiblePkg._id || eligiblePkg.id,
                                _is_redeemed_pkg_line: true,
                              };
                              setCartItems((prev) => [
                                ...prev.map((x) =>
                                  x.cart_id === ci.cart_id
                                    ? {
                                        ...x,
                                        _paired_pkg_cart_id: newPkgCartId,
                                        package_redemption_id: eligiblePkg._id || eligiblePkg.id,
                                        _wallet_redeem: false,
                                      }
                                    : x
                                ),
                                pkgLine,
                              ]);
                            }
                          }}
                          title="Click to add the availed package as ₹0 line and redeem 1 credit"
                        >
                          {ci._paired_pkg_cart_id
                            ? `✓ Redeeming: ${eligiblePkg.package_master?.name || "Package"} (${remainingCreditsForLine} left)`
                            : `Redeem Credit (${remainingCreditsForLine} left)`}
                        </button>
                      )}

                      {/* Amount wallet redeem — partial/full rupee deduction on this line */}
                      {isWalletEligible && ci.item_type !== "package" && (
                        <button
                          type="button"
                          className={`pos-pkg-toggle-btn ${ci._wallet_redeem ? "active" : ""}`}
                          onClick={() => {
                            if (ci._wallet_redeem) {
                              setCartItems((prev) =>
                                prev.map((x) =>
                                  x.cart_id === ci.cart_id
                                    ? {
                                        ...x,
                                        _wallet_redeem: false,
                                        package_redemption_id: null,
                                        _paired_pkg_cart_id: null,
                                      }
                                    : x
                                )
                              );
                              return;
                            }

                            const pkgId = eligiblePkg._id || eligiblePkg.id;
                            const available = getRemainingWalletBalance(
                              pkgId,
                              customerActivePackages,
                              cartItems,
                              lineDiscountByCartId,
                              ci.cart_id
                            );
                            if (available <= 0) {
                              alert("No wallet balance remaining for this package.");
                              return;
                            }

                            setCartItems((prev) =>
                              prev.map((x) =>
                                x.cart_id === ci.cart_id
                                  ? {
                                      ...x,
                                      _wallet_redeem: true,
                                      package_redemption_id: pkgId,
                                      _paired_pkg_cart_id: null,
                                    }
                                  : x
                              )
                            );
                          }}
                          title="Apply wallet balance to this line"
                        >
                          {ci._wallet_redeem
                            ? `✓ Wallet applied −${formatInr(walletDeduction)} · remaining ${formatInr(walletRemainingAfter)}`
                            : `Use Wallet (${formatInr(
                                getRemainingWalletBalance(
                                  eligiblePkg._id || eligiblePkg.id,
                                  customerActivePackages,
                                  cartItems,
                                  lineDiscountByCartId,
                                  ci.cart_id
                                )
                              )} left)`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Invoice Notes */}
          <div className="pos-cart-notes">
            <input
              type="text"
              placeholder="Optional notes (e.g. Chair #2, Birthday discount, Customer preferences)..."
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
            />
          </div>

          {/* Bill Summary Breakdown */}
          <div className="pos-cart-summary">
            <div className="pos-summary-line">
              <span>Subtotal</span>
              <span>{formatInr(billSummary.subtotal)}</span>
            </div>
            <label className="pos-summary-line pos-discount-field">
              <span>Discount %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={billDiscountPercent}
                disabled={cartItems.length === 0}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === "") {
                    setBillDiscountPercent("");
                    return;
                  }
                  const n = Number(next);
                  if (!Number.isFinite(n)) return;
                  setBillDiscountPercent(String(Math.min(100, Math.max(0, n))));
                }}
                aria-label="Bill discount percent"
              />
            </label>
            <label className="pos-summary-line pos-discount-field">
              <span>Discount type</span>
              <select
                value={selectedDiscountId}
                disabled={cartItems.length === 0}
                onChange={(e) => {
                  setSelectedDiscountId(e.target.value);
                }}
                aria-label="Discount type"
              >
                <option value="">None</option>
                {availableDiscounts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({Number(item.percent || 0)}%)
                  </option>
                ))}
              </select>
            </label>
            {billSummary.totalDiscount > 0 && (
              <div className="pos-summary-line discount">
                <span>
                  Discount
                  {appliedDiscountPercent > 0 ? ` (${appliedDiscountPercent}%)` : ""}
                </span>
                <span>−{formatInr(billSummary.totalDiscount)}</span>
              </div>
            )}
            <div className="pos-summary-line">
              <span>Estimated GST / Tax (approx 18%)</span>
              <span>{formatInr(billSummary.estimatedTax)}</span>
            </div>
            <div className="pos-summary-line total">
              <span>Grand Total Due</span>
              <strong>{formatInr(billSummary.grandTotal)}</strong>
            </div>
          </div>

          {/* Massive Touchscreen Payment Actions */}
          <div className="pos-checkout-actions">
            <button
              type="button"
              disabled={isSubmitting || cartItems.length === 0}
              className="pos-pay-btn cash"
              onClick={() => handleCheckout("cash")}
            >
              <span>Cash</span>
              <small>Immediate payment</small>
            </button>
            <button
              type="button"
              disabled={isSubmitting || cartItems.length === 0}
              className="pos-pay-btn upi"
              onClick={() => handleCheckout("upi")}
            >
              <span>UPI / QR</span>
              <small>GPay / PhonePe</small>
            </button>
            <button
              type="button"
              disabled={isSubmitting || cartItems.length === 0}
              className="pos-pay-btn card"
              onClick={() => handleCheckout("card")}
            >
              <span>Card</span>
              <small>POS terminal swipe</small>
            </button>
            <button
              type="button"
              disabled={isSubmitting || cartItems.length === 0}
              className="pos-pay-btn split"
              onClick={() => {
                if (cartItems.length === 0) return;
                setCheckoutError(null);
                const missingStaff = cartItems.some((ci) => !ci.staff_id);
                if (missingStaff) {
                  setCheckoutError("Please assign a Stylist / Staff member for every line item first.");
                  return;
                }
                setIsSplitModalOpen(true);
              }}
            >
              <span>Split Payment</span>
              <small>Cash + UPI + Card</small>
            </button>
          </div>
        </aside>
      </div>

      {/* ── Customer Search & Selection Popover/Modal ─────────────────────── */}
      {isCustomerSearchOpen && (
        <div className="pos-modal-backdrop" onClick={() => setIsCustomerSearchOpen(false)}>
          <div className="pos-modal pos-modal--customer" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal-header">
              <h3>👤 Select or Add Customer</h3>
              <button type="button" className="pos-modal-close" onClick={() => setIsCustomerSearchOpen(false)}>
                ✕
              </button>
            </div>

            <div className="pos-modal-body">
              {/* Walk-in option */}
              <button
                type="button"
                className="pos-walkin-btn"
                onClick={() => {
                  setSelectedCustomer(null);
                  setIsCustomerSearchOpen(false);
                }}
              >
                🚶 Select Walk-in Customer (No phone / package tracking)
              </button>

              <hr style={{ margin: "1.25rem 0", borderTop: "1px dashed #cbd5e1" }} />

              {/* Search input */}
              <div className="inventory-form-group">
                <label>Search Existing Customer (Phone, Name, or Email)</label>
                <input
                  type="text"
                  placeholder="Type at least 2 digits/characters..."
                  value={customerSearchQuery}
                  onChange={(e) => handleSearchCustomer(e.target.value)}
                  autoFocus
                />
              </div>

              {isSearchingCustomer && <p className="status-note">Searching database…</p>}

              {customerSearchResults.length > 0 && (
                <div className="pos-customer-results-list">
                  {customerSearchResults.map((cust) => (
                    <div
                      key={cust._id || cust.id}
                      className="pos-customer-result-item"
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setIsCustomerSearchOpen(false);
                      }}
                    >
                      <div>
                        <strong>{cust.name}</strong>
                        <span>📞 {cust.phone || "No phone"}</span>
                      </div>
                      <span className="user-primary-btn" style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}>
                        Select →
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <hr style={{ margin: "1.25rem 0", borderTop: "1px dashed #cbd5e1" }} />

              {/* Quick create customer */}
              <h4>+ Quick Add New Customer</h4>
              <form onSubmit={handleQuickCreateCustomer} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "end" }}>
                <div className="inventory-form-group" style={{ margin: 0 }}>
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Priya Sharma"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                  />
                </div>
                <div className="inventory-form-group" style={{ margin: 0 }}>
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="10-digit mobile"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                  />
                </div>
                <button type="submit" className="user-primary-btn" style={{ padding: "0.6rem 1rem" }}>
                  Save & Select
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-Mode Payment Split Modal ─────────────────────────────────── */}
      <PaymentSplitModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        grandTotal={billSummary.grandTotal}
        onConfirm={(splitPaymentsArray) => handleCheckout("split", splitPaymentsArray)}
      />

      {/* ── Checkout Celebration & Receipt Modal ───────────────────────────── */}
      {completedInvoice && (
        <>
          {/* Screen Modal View */}
          <div className="pos-modal-backdrop" onClick={() => {
            setCompletedInvoice(null);
            setLastPackageRedemptions([]);
          }}>
            <div className="pos-modal pos-modal--receipt" onClick={(e) => e.stopPropagation()}>
              <div className="pos-receipt-banner" style={{ position: "relative" }}>
                <button
                  type="button"
                  className="pos-modal-close no-print"
                  onClick={() => {
                    setCompletedInvoice(null);
                    setLastPackageRedemptions([]);
                  }}
                  title="Back to POS screen"
                  style={{
                    position: "absolute",
                    top: "1rem",
                    right: "1.25rem",
                    color: "#ffffff",
                    background: "rgba(0, 0, 0, 0.25)",
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    fontSize: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    border: "1px solid rgba(255, 255, 255, 0.3)"
                  }}
                >
                  ✕
                </button>
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, marginTop: "0.5rem" }}>Billing Completed Successfully!</h2>
                <p style={{ fontFamily: "'Inter', sans-serif" }}>Invoice created atomically and stock/credits updated.</p>
              </div>

              <div className="pos-receipt-body">
                {lastPackageRedemptions.length > 0 && (
                  <div
                    className="no-print"
                    style={{
                      marginBottom: "1rem",
                      padding: "0.85rem 1rem",
                      border: "1px solid #99f6e4",
                      background: "#ecfdf5",
                      borderRadius: "0",
                    }}
                  >
                    <strong style={{ display: "block", color: "#0f766e", marginBottom: "0.45rem" }}>
                      Package credit used — send WhatsApp update
                    </strong>
                    {lastPackageRedemptions.map((row) => (
                      <div
                        key={row.packageId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "0.75rem",
                          marginTop: "0.45rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontSize: "0.875rem", color: "#334e68" }}>
                          {row.packageName}: used {row.creditsUsed}, remaining{" "}
                          <strong>
                            {row.creditsRemaining}
                            {row.creditsTotal ? ` / ${row.creditsTotal}` : ""}
                          </strong>
                        </span>
                        <button
                          type="button"
                          className="user-secondary-btn"
                          style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
                          onClick={() => openPackageCreditUsedWhatsApp(row)}
                        >
                          WhatsApp
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pos-receipt-metric-box">
                  <div>
                    <span>Invoice Number</span>
                    <strong>{completedInvoice.invoice_number || `INV-${completedInvoice._id?.slice(-6)?.toUpperCase()}`}</strong>
                  </div>
                  <div>
                    <span>Payment Mode</span>
                    <strong style={{ textTransform: "uppercase" }}>{completedInvoice.payment_mode}</strong>
                  </div>
                  <div>
                    <span>Grand Total</span>
                    <strong style={{ color: "#166534", fontSize: "1.25rem" }}>
                      {formatInr(completedInvoice.grand_total || billSummary.grandTotal)}
                    </strong>
                  </div>
                </div>

                <div className="pos-receipt-items-preview">
                  <h4>Bill Line Items ({completedInvoice.line_items?.length || cartItems.length})</h4>
                  <ul>
                    {(completedInvoice.line_items || cartItems).map((li, idx) => (
                      <li key={idx}>
                        <span>
                          {li.quantity}x {li.item_name}
                          {li.package_redemption_id && <small style={{ color: "#166534", marginLeft: "6px" }}>(Redeemed)</small>}
                        </span>
                        <div style={{ textAlign: "right" }}>
                          {li.package_redemption_id && (
                            <small style={{ display: "block", textDecoration: "line-through", color: "#64748b" }}>
                              {formatInr(li.unit_price * li.quantity)}
                            </small>
                          )}
                          <strong>{formatInr(li.total_amount ?? (li.unit_price * li.quantity - (li.discount_amount || 0)))}</strong>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pos-modal-footer" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: "0.65rem" }}>
                <button
                  type="button"
                  className="user-secondary-btn"
                  onClick={() => setCompletedInvoice(null)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontWeight: "bold" }}
                >
                  ← Back to POS Screen
                </button>

                <div style={{ display: "flex", gap: "0.65rem" }}>
                  <button
                    type="button"
                    className="user-secondary-btn"
                    onClick={() => window.print()}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe" }}
                  >
                    Print / Save Receipt
                  </button>
                  <button
                    type="button"
                    className="user-primary-btn"
                    onClick={() => {
                      setCompletedInvoice(null);
                      setLastPackageRedemptions([]);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    🛒 Start New Sale →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated Printable Bill of Supply / GST Invoice (Hidden on screen, revealed by @media print) */}
          <div className="pos-printable-receipt">
            <div className="pos-print-header">
              <h1>S21 SALON MANAGEMENT SYSTEM</h1>
              <p>Tax Invoice / Bill of Supply</p>
              <p>Branch: Terminal 1 | GSTIN: 27AABCS1429B1Z5</p>
            </div>

            <div className="pos-print-meta">
              <div>
                <strong>Invoice No:</strong> {completedInvoice.invoice_number || `INV-${completedInvoice._id?.slice(-6)?.toUpperCase()}`}<br />
                <strong>Date & Time:</strong> {new Date(completedInvoice.createdAt || Date.now()).toLocaleString()}
              </div>
              <div style={{ textAlign: "right" }}>
                <strong>Customer:</strong> {completedInvoice.customer_name || "Walk-in Customer"}<br />
                {completedInvoice.customer_phone ? `Phone: ${completedInvoice.customer_phone}` : "No contact saved"}
              </div>
            </div>

            <table className="pos-print-table">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>#</th>
                  <th style={{ width: "42%" }}>Item Description / Stylist</th>
                  <th style={{ width: "12%" }}>Qty</th>
                  <th style={{ width: "18%" }}>Rate (₹)</th>
                  <th style={{ width: "20%", textAlign: "right" }}>Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {(completedInvoice.line_items || cartItems).map((li, idx) => {
                  const lineTotal = li.total_amount ?? (li.unit_price * li.quantity - (li.discount_amount || 0));
                  // Find staff display name if staff_id is an ObjectId or reference
                  const stylistObj = staffList.find((s) => (s._id || s.id) === String(li.staff_id));
                  const stylistName = stylistObj ? (stylistObj.display_name || stylistObj.first_name) : "Assigned Staff";

                  return (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{li.item_name}</strong>
                        {li.package_redemption_id && <span style={{ fontSize: "10px", color: "#166534" }}> [Package Credit]</span>}
                        <br />
                        <span style={{ fontSize: "10px", color: "#555555" }}>Stylist: {stylistName}</span>
                      </td>
                      <td>{li.quantity}</td>
                      <td>{Number(li.unit_price || 0).toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{Number(lineTotal).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pos-print-totals">
              <div className="pos-print-totals-row">
                <span>Subtotal:</span>
                <span>₹{(completedInvoice.subtotal || billSummary.subtotal || 0).toFixed(2)}</span>
              </div>
              {(completedInvoice.total_discount || billSummary.totalDiscount || 0) > 0 && (
                <div className="pos-print-totals-row">
                  <span>Discounts / Redemptions:</span>
                  <span>−₹{(completedInvoice.total_discount || billSummary.totalDiscount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="pos-print-totals-row">
                <span>Estimated GST / Tax:</span>
                <span>₹{(completedInvoice.total_tax || billSummary.estimatedTax || 0).toFixed(2)}</span>
              </div>
              <div className="pos-print-totals-row grand">
                <span>GRAND TOTAL DUE:</span>
                <span>₹{(completedInvoice.grand_total || billSummary.grandTotal || 0).toFixed(2)}</span>
              </div>
              <div className="pos-print-totals-row" style={{ marginTop: "4px", fontStyle: "italic" }}>
                <span>Payment Mode:</span>
                <span style={{ textTransform: "uppercase", fontWeight: "bold" }}>
                  {completedInvoice.payment_mode}
                  {completedInvoice.payment_mode === "split" && completedInvoice.split_payments && (
                    ` (${completedInvoice.split_payments.map((sp) => `${sp.mode.toUpperCase()}: ₹${sp.amount}`).join(", ")})`
                  )}
                </span>
              </div>
            </div>

            <div className="pos-print-footer">
              <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>Thank you for visiting S21 Salon!</p>
              <p style={{ margin: "0" }}>We look forward to styling you again soon. • Computer Generated Invoice</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

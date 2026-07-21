import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { arnavApi, preciousApi } from "../../api";
import { fetchStaffProfiles } from "../../api/staffApi.js";
import { fetchPackageMasters } from "../../api/packageMasterApi.js";
import { formatInr } from "../../utils/earningsFormat.js";    
import { BILLING_HANDOFF_PARAM } from "../../utils/billingHandoff.js";
import PaymentSplitModal from "../../components/billing/PaymentSplitModal.jsx";

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

  // Filter & Search states
  const [activeTab, setActiveTab] = useState("services"); // "services" | "products" | "packages" | "all"
  const [searchQuery, setSearchQuery] = useState("");

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
  const [invoiceNotes, setInvoiceNotes] = useState("");

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

      const price =
  type === "service"
    ? Number(item.price || item.default_price || 0)
    : type === "product"
    ? Number(item.sale_price || item.default_retail_price || item.price || 0)
    : Number(item.price || 0);

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
        const next = { ...ci, ...updates };
        // If package_redemption_id is turned on, set price/discount to reflect redemption
        if (updates.package_redemption_id !== undefined) {
          if (updates.package_redemption_id) {
            next.discount_amount = next.unit_price * next.quantity; // 100% covered by package credit
          } else {
            next.discount_amount = 0;
          }
        }
        return next;
      })
    );
  };

  // Remove Cart Item
  const removeCartItem = (cartId) => {
    setCartItems((prev) => prev.filter((ci) => ci.cart_id !== cartId));
  };

  // Check if a line item can be redeemed against one of the customer's active packages
  const getEligiblePackageForLine = (lineItem) => {
    if (lineItem.item_type !== "service" || customerActivePackages.length === 0) return null;
    // Find active package whose credits > 0 and included_services has this service or is open
    return customerActivePackages.find((pkg) => {
      if ((pkg.credits_remaining || 0) <= 0 && pkg.type !== "membership") return false;
      const inc = pkg.package_master_id?.included_services || [];
      if (inc.length === 0) return true; // blanket package
      const lineIdString = String(lineItem.item_id);
      return inc.some((s) => String(s._id || s.id || s) === lineIdString);
    });
  };

  // Filter catalog items based on tab & search query
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let combined = [];
    if (activeTab === "all" || activeTab === "services") {
      combined = combined.concat(
        services.map((s) => ({ ...s, _type: "service" }))
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
  }, [activeTab, searchQuery, services, products, packages]);

  // Compute subtotal & grand total
  const billSummary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    cartItems.forEach((ci) => {
      const lineTotalRaw = ci.unit_price * ci.quantity;
      subtotal += lineTotalRaw;
      totalDiscount += Number(ci.discount_amount || 0);
    });
    const taxable = Math.max(0, subtotal - totalDiscount);
    // Estimated GST 18% (backend auto-resolves TaxMaster precisely during save)
    const estimatedTax = Number((taxable * 0.18).toFixed(2));
    const grandTotal = Number((taxable + estimatedTax).toFixed(2));
    return { subtotal, totalDiscount, taxable, estimatedTax, grandTotal };
  }, [cartItems]);

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
    try {
      const payload = {
        customer_id: selectedCustomer ? selectedCustomer._id || selectedCustomer.id : undefined,
        customer_name: selectedCustomer ? selectedCustomer.name : "Walk-in Customer",
        customer_phone: selectedCustomer ? selectedCustomer.phone : undefined,
        payment_mode: paymentMode,
        payment_status: "paid",
        split_payments: splitPaymentsArray || undefined,
        notes: buildInvoiceNotes(),
        line_items: cartItems.map((ci) => ({
          item_type: ci.item_type,
          item_id: ci.item_id,
          item_name: ci.item_name,
          staff_id: ci.staff_id,
          quantity: ci.quantity,
          unit_price: ci.unit_price,
          tax_rate: ci.tax_rate !== undefined ? ci.tax_rate : (ci.item_type === "package" ? 0 : 18),
          discount_amount: ci.discount_amount || 0,
          package_redemption_id: ci.package_redemption_id || undefined,
        })),
      };

      const res = await preciousApi.createInvoice(payload);
      if (res?.success || res?.data) {
        setCompletedInvoice(res.data || res);
        setIsSplitModalOpen(false);
        // Reset cart
        setCartItems([]);
        setInvoiceNotes("");
      } else {
        throw new Error(res?.message || "Failed to create invoice");
      }
    } catch (err) {
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
            <span className="pos-customer-icon">•</span>
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
              onClick={() => setActiveTab("services")}
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
          </div>

          {/* Search Bar */}
          <div className="pos-search-bar">
            {/* <span>🔎</span> */}
            <input
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
          ) : filteredCatalog.length === 0 ? (
            <div className="pos-catalog-empty">No matching catalog items found for "{searchQuery}".</div>
          ) : (
            <div className="pos-items-grid">
              {filteredCatalog.map((item) => {
                const type = item._type;
                const itemId = item._id || item.id;
                const price =
                  type === "service"
                    ? (item.price || item.default_price) > 0 ? (item.price || item.default_price) : 300
                    : type === "product"
                    ? (item.sale_price || item.selling_price || item.default_retail_price || item.price) > 0 ? (item.sale_price || item.selling_price || item.default_retail_price || item.price) : (item.purchase_price || 299)
                    : item.price || 0;
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
                const isRedeemed = Boolean(ci.package_redemption_id);

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
                        {isRedeemed ? (
                          <span className="pos-redeemed-price">₹0.00 (Redeemed)</span>
                        ) : (
                          <div className="pos-item-price-calc">
                            <small>₹{ci.unit_price} x {ci.quantity}</small>
                            <strong>{formatInr(ci.unit_price * ci.quantity - ci.discount_amount)}</strong>
                          </div>
                        )}
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
                              {st.display_name || st.first_name || st.phone || `Staff #${st._id}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Package Credit Toggle */}
                      {eligiblePkg && (
                        <button
                          type="button"
                          className={`pos-pkg-toggle-btn ${isRedeemed ? "active" : ""}`}
                          onClick={() =>
                            updateCartItem(ci.cart_id, {
                              package_redemption_id: isRedeemed ? null : eligiblePkg._id || eligiblePkg.id,
                            })
                          }
                          title="Redeem 1 package credit instead of paying cash/card"
                        >
                          {isRedeemed ? "Redeeming Credit (Active)" : `Redeem Credit (${eligiblePkg.credits_remaining} left)`}
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
            {billSummary.totalDiscount > 0 && (
              <div className="pos-summary-line discount">
                <span>Redemptions / Discounts</span>
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
          <div className="pos-modal-backdrop" onClick={() => setCompletedInvoice(null)}>
            <div className="pos-modal pos-modal--receipt" onClick={(e) => e.stopPropagation()}>
              <div className="pos-receipt-banner" style={{ position: "relative" }}>
                <button
                  type="button"
                  className="pos-modal-close no-print"
                  onClick={() => setCompletedInvoice(null)}
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
                        <strong>{formatInr(li.total_amount ?? (li.unit_price * li.quantity - (li.discount_amount || 0)))}</strong>
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
                    onClick={() => setCompletedInvoice(null)}
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

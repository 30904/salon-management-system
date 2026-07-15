import { useEffect, useId, useRef, useState } from "react";
import { arnavApi } from "../../api";
import { usePermission } from "../../hooks/usePermission.js";

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 2;

function looksLikePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= MIN_SEARCH_LENGTH;
}

function splitSearchQuery(query) {
  const trimmed = String(query || "").trim();

  if (!trimmed) {
    return { name: "", phone: "" };
  }

  if (looksLikePhone(trimmed)) {
    return {
      name: "",
      phone: trimmed.replace(/\D/g, ""),
    };
  }

  return { name: trimmed, phone: "" };
}

export default function CustomerSearchOrCreate({
  value = null,
  onChange,
  label = "Customer",
  required = false,
  disabled = false,
  touchLarge = false,
  className = "",
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const { hasPermission } = usePermission();

  const canSearch = hasPermission("crm", "view");
  const canCreate = hasPermission("crm", "create");
  const isDisabled = disabled || !canSearch;

  const [isEditing, setIsEditing] = useState(!value);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    setIsEditing(!value);
  }, [value]);

  useEffect(() => {
    if (!isEditing || !canSearch) {
      return undefined;
    }

    const trimmed = query.trim();

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return undefined;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = window.setTimeout(async () => {
      try {
        const response = await arnavApi.searchCustomers({ q: trimmed });

        if (!response.success) {
          throw new Error(response.message || "Customer search failed");
        }

        setResults(response.data || []);
        setShowResults(true);

        if ((response.data || []).length === 0 && canCreate) {
          setShowCreateForm(true);
          setCreateForm(splitSearchQuery(trimmed));
        }
      } catch (error) {
        setResults([]);
        setSearchError(error.response?.data?.message || error.message);
      } finally {
        setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, isEditing, canSearch, canCreate]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function resetSearchState() {
    setQuery("");
    setResults([]);
    setSearchError(null);
    setShowResults(false);
    setShowCreateForm(false);
    setCreateForm({ name: "", phone: "" });
    setCreateError(null);
  }

  function handleSelectCustomer(customer) {
    onChange?.(customer);
    resetSearchState();
    setIsEditing(false);
  }

  function handleClearSelection() {
    onChange?.(null);
    resetSearchState();
    setIsEditing(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function handleQueryChange(nextQuery) {
    setQuery(nextQuery);
    setShowCreateForm(false);
    setCreateError(null);

    if (nextQuery.trim().length >= MIN_SEARCH_LENGTH) {
      setShowResults(true);
    } else {
      setShowResults(false);
      setResults([]);
    }
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!canCreate) {
      setCreateError("You do not have permission to create customers.");
      return;
    }

    const name = createForm.name.trim();
    const phone = createForm.phone.trim();

    if (!name) {
      setCreateError("Customer name is required.");
      return;
    }

    if (!phone) {
      setCreateError("Customer phone is required.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await arnavApi.findOrCreateCustomer({
        name,
        phone,
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to save customer");
      }

      const customer = response.data?.customer;

      if (!customer?.id) {
        throw new Error("Customer was saved but no customer id was returned");
      }

      handleSelectCustomer(customer);
    } catch (error) {
      setCreateError(error.response?.data?.message || error.message);
    } finally {
      setIsCreating(false);
    }
  }

  const rootClassName = [
    "customer-search",
    touchLarge ? "customer-search--touch" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (!isEditing && value) {
    return (
      <div className={rootClassName} ref={rootRef}>
        <div className="customer-search__label-row">
          <span className="customer-search__label">
            {label}
            {required ? <span className="customer-search__required">*</span> : null}
          </span>
        </div>

        <div className="customer-search__selected">
          <div>
            <strong>{value.name}</strong>
            {value.phone ? (
              <p className="customer-search__selected-phone">{value.phone}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="user-secondary-btn customer-search__change-btn"
            onClick={handleClearSelection}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClassName} ref={rootRef}>
      <label className="customer-search__field" htmlFor={`${listboxId}-input`}>
        <span className="customer-search__label">
          {label}
          {required ? <span className="customer-search__required">*</span> : null}
        </span>
        <input
          id={`${listboxId}-input`}
          ref={searchInputRef}
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          onFocus={() => {
            if (results.length > 0) {
              setShowResults(true);
            }
          }}
          placeholder="Search by name or phone"
          autoComplete="off"
          disabled={isDisabled}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />
      </label>

      {!canSearch ? (
        <p className="customer-search__hint customer-search__hint--error">
          You do not have permission to search customers.
        </p>
      ) : null}

      {isSearching ? (
        <p className="customer-search__hint">Searching customers...</p>
      ) : null}

      {searchError ? (
        <p className="customer-search__hint customer-search__hint--error">
          {searchError}
        </p>
      ) : null}

      {showResults && results.length > 0 ? (
        <ul className="customer-search__results" id={listboxId} role="listbox">
          {results.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="customer-search__result-btn"
                role="option"
                onClick={() => handleSelectCustomer(customer)}
              >
                <span className="customer-search__result-name">{customer.name}</span>
                {customer.phone ? (
                  <span className="customer-search__result-phone">{customer.phone}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showResults &&
      query.trim().length >= MIN_SEARCH_LENGTH &&
      !isSearching &&
      results.length === 0 &&
      !showCreateForm ? (
        <p className="customer-search__hint">No customers found.</p>
      ) : null}

      {canCreate ? (
        <div className="customer-search__create-panel">
          {!showCreateForm ? (
            <button
              type="button"
              className="user-secondary-btn customer-search__create-toggle"
              onClick={() => {
                setShowCreateForm(true);
                setCreateForm(splitSearchQuery(query));
                setCreateError(null);
              }}
              disabled={isDisabled}
            >
              Add new customer
            </button>
          ) : (
            <div className="customer-search__create-form">
              <p className="customer-search__create-title">Create customer</p>

              <label className="customer-search__field">
                <span className="customer-search__label">Name</span>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateCustomer(event);
                    }
                  }}
                  disabled={isDisabled || isCreating}
                  autoComplete="name"
                />
              </label>

              <label className="customer-search__field">
                <span className="customer-search__label">Phone</span>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreateCustomer(event);
                    }
                  }}
                  disabled={isDisabled || isCreating}
                  autoComplete="tel"
                />
              </label>

              {createError ? (
                <p className="customer-search__hint customer-search__hint--error">
                  {createError}
                </p>
              ) : null}

              <div className="customer-search__create-actions">
                <button
                  type="button"
                  className="user-primary-btn"
                  disabled={isDisabled || isCreating}
                  onClick={handleCreateCustomer}
                >
                  {isCreating ? "Saving..." : "Save customer"}
                </button>
                <button
                  type="button"
                  className="user-secondary-btn"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateError(null);
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

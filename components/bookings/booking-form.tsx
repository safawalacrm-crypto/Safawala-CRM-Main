'use client';

import { useMemo, useRef, useState, type SyntheticEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Box,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Package,
  Phone,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BOOKING_TERMS, money } from '@/lib/bookings';
import {
  BARATI_SAFA_SUBCATEGORIES,
  INVENTORY_CATEGORIES,
  sameInventoryValue,
} from '@/lib/inventory-catalog';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/layout/dashboard-header';

type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
};
type Product = {
  id: number;
  sku: string | null;
  barcode: string | null;
  name: string;
  category: string | null;
  subcategory: string | null;
  sale_price: number;
  rental_price: number;
  security_deposit: number;
  stock_quantity: number;
  image_urls: string[];
};
type PackageRow = {
  id: number;
  name: string;
  sale_price: number;
  rental_price: number;
  security_deposit: number;
};
type RentalPackage = {
  id: number;
  name: string;
  category_name: string;
  rental_price: number;
  extra_safa_price: number;
  security_deposit: number;
  image_url: string | null;
  inclusions: string[];
};
type Staff = { id: number; name: string };
type Item = {
  key: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  security_deposit: number;
  product_id?: number;
  package_id?: number;
  package_variant_id?: number;
  additional_safa?: boolean;
};

const inputClass =
  'h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';
const uid = () => Math.random().toString(36).slice(2);

export function BookingForm({
  ownerId,
  customers,
  products,
  packages,
  rentalPackages,
  staff,
  quoteOnly = false,
}: {
  ownerId: string;
  customers: Customer[];
  products: Product[];
  packages: PackageRow[];
  rentalPackages: RentalPackage[];
  staff: Staff[];
  quoteOnly?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<'sale' | 'rental' | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [customerList, setCustomerList] = useState(customers);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('all');
  const [productSubcategory, setProductSubcategory] = useState('all');
  const [packageSearch, setPackageSearch] = useState('');
  const [additionalSafaPackage, setAdditionalSafaPackage] = useState('all');
  const [additionalSafaSearch, setAdditionalSafaSearch] = useState('');
  const [additionalSafaProductId, setAdditionalSafaProductId] = useState('');
  const [additionalSafaQuantity, setAdditionalSafaQuantity] = useState(1);
  const [bypassSafaLimit, setBypassSafaLimit] = useState(false);
  const [rentalNotes, setRentalNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [discount, setDiscount] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [paid, setPaid] = useState(0);
  const [modificationsRequired, setModificationsRequired] = useState(false);
  const [eventType, setEventType] = useState('Wedding');
  const [eventFor, setEventFor] = useState('Groom Only');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [venue, setVenue] = useState('');
  const [contactName, setContactName] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [rentalSelectionMode, setRentalSelectionMode] = useState<
    'individual' | 'packages'
  >('individual');
  const [selectedRentalCategory, setSelectedRentalCategory] = useState(
    rentalPackages[0]?.category_name ?? '',
  );
  const [selectedRentalPackageId, setSelectedRentalPackageId] = useState<
    number | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const isSale = type === 'sale';
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [items],
  );
  const deposit = useMemo(
    () =>
      isSale ? 0 : items.reduce((sum, item) => sum + item.security_deposit, 0),
    [items, isSale],
  );
  const taxable = Math.max(subtotal - discount, 0);
  const tax = taxEnabled ? Math.round(taxable * 0.05) : 0;
  const total = taxable + tax + deposit;
  const matchingCustomers = customerList.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.email ?? ''}`
      .toLowerCase()
      .includes(customerSearch.toLowerCase()),
  );
  const visibleCustomers = matchingCustomers.slice(0, 5);
  const productSubcategoryOptions = [
    ...new Set([
      ...(sameInventoryValue(productCategory, 'BARATI SAFA')
        ? BARATI_SAFA_SUBCATEGORIES
        : []),
      ...(products
        .filter(
          (product) =>
            productCategory === 'all' ||
            sameInventoryValue(product.category, productCategory),
        )
        .map((product) => product.subcategory)
        .filter(Boolean) as string[]),
    ]),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const visibleProducts = products.filter((product) => {
    const matchesSearch =
      `${product.name} ${product.barcode ?? ''} ${product.sku ?? ''} ${product.category ?? ''} ${product.subcategory ?? ''}`
        .toLowerCase()
        .includes(productSearch.toLowerCase());
    const matchesCategory =
      productCategory === 'all' ||
      sameInventoryValue(product.category, productCategory);
    const matchesSubcategory =
      productSubcategory === 'all' ||
      sameInventoryValue(product.subcategory, productSubcategory);
    return matchesSearch && matchesCategory && matchesSubcategory;
  });
  const rentalPackageCategories = [
    ...new Set(rentalPackages.map((pack) => pack.category_name)),
  ];
  const visibleRentalPackages = rentalPackages.filter(
    (pack) =>
      pack.category_name === selectedRentalCategory &&
      `${pack.name} ${pack.category_name} ${pack.inclusions.join(' ')}`
        .toLowerCase()
        .includes(packageSearch.trim().toLowerCase()),
  );
  const selectedRentalPackage =
    rentalPackages.find((pack) => pack.id === selectedRentalPackageId) ?? null;
  const packageSafaLimit = Number(
    selectedRentalPackage?.category_name.match(/\d+/)?.[0] ?? 0,
  );
  const additionalSafaCount = items
    .filter((item) => item.additional_safa)
    .reduce((total, item) => total + item.quantity, 0);
  const additionalSafaPackages = [
    ...new Set([
      ...BARATI_SAFA_SUBCATEGORIES,
      products
        .filter((product) => sameInventoryValue(product.category, 'BARATI SAFA'))
        .map((product) => product.subcategory)
        .filter(Boolean) as string[],
    ].flat()),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const additionalSafaProducts = products.filter((product) => {
    const inBaratiSafa = sameInventoryValue(product.category, 'BARATI SAFA');
    const matchesPackage =
      additionalSafaPackage === 'all' ||
      sameInventoryValue(product.subcategory, additionalSafaPackage);
    const matchesSearch = `${product.name} ${product.barcode ?? ''} ${product.sku ?? ''}`
      .toLowerCase()
      .includes(additionalSafaSearch.trim().toLowerCase());
    return inBaratiSafa && matchesPackage && matchesSearch;
  });
  const selectedAdditionalSafaProduct =
    additionalSafaProducts.find(
      (product) => product.id === Number(additionalSafaProductId),
    ) ?? null;

  function addProduct(product: Product) {
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing)
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      return [
        ...current,
        {
          key: uid(),
          product_id: product.id,
          item_name: product.name,
          quantity: 1,
          unit_price: Number(
            isSale ? product.sale_price : product.rental_price,
          ),
          security_deposit: isSale ? 0 : Number(product.security_deposit),
        },
      ];
    });
  }

  function addPackage(pack: PackageRow) {
    setItems((current) => [
      ...current,
      {
        key: uid(),
        package_id: pack.id,
        item_name: pack.name,
        quantity: 1,
        unit_price: Number(isSale ? pack.sale_price : pack.rental_price),
        security_deposit: isSale ? 0 : Number(pack.security_deposit),
      },
    ]);
  }

  function addRentalPackage(pack: RentalPackage) {
    setSelectedRentalPackageId(pack.id);
    setItems((current) => [
      ...current
        .filter((item) => !item.package_variant_id)
        .map((item) =>
          item.additional_safa
            ? { ...item, unit_price: Number(pack.extra_safa_price) }
            : item,
        ),
      {
        key: uid(),
        package_variant_id: pack.id,
        item_name: `${pack.category_name} · ${pack.name}`,
        quantity: 1,
        unit_price: Number(pack.rental_price),
        security_deposit: Number(pack.security_deposit),
      },
    ]);
  }

  function addAdditionalSafa() {
    const product = products.find(
      (item) => item.id === Number(additionalSafaProductId),
    );
    if (!selectedRentalPackage || !product) {
      setMessage({
        title: 'Select the package and Safa',
        text: 'Choose a package variant and a Barati Safa product first.',
      });
      return;
    }
    const quantity = Math.max(1, Math.floor(additionalSafaQuantity || 1));
    if (
      !bypassSafaLimit &&
      packageSafaLimit > 0 &&
      additionalSafaCount + quantity > packageSafaLimit
    ) {
      setMessage({
        title: 'Package Safa limit reached',
        text: `This package allows ${packageSafaLimit} Safas. Enable Bypass limit only when an exception is approved.`,
      });
      return;
    }
    setMessage(null);
    setItems((current) => {
      const existing = current.find(
        (item) => item.additional_safa && item.product_id === product.id,
      );
      if (existing) {
        return current.map((item) =>
          item.key === existing.key
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [
        ...current,
        {
          key: uid(),
          product_id: product.id,
          additional_safa: true,
          item_name: `Additional Safa · ${product.name}`,
          quantity,
          unit_price: Number(selectedRentalPackage.extra_safa_price),
          security_deposit: 0,
        },
      ];
    });
    setAdditionalSafaQuantity(1);
  }

  function updateItem(key: string, patch: Partial<Item>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function showStep(nextStep: 1 | 2 | 3) {
    setMessage(null);
    setStep(nextStep);
    requestAnimationFrame(() =>
      document
        .getElementById('booking-workflow')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }

  function continueFromCustomer() {
    if (!selectedCustomer) {
      setMessage({
        title: 'Select a customer',
        text: 'Choose an existing customer or create a new one before continuing.',
      });
      return;
    }
    if (!eventType || !eventFor || !eventDate || !venue.trim()) {
      setMessage({
        title: 'Complete the event details',
        text: 'Event type, booking for, event date and venue are required.',
      });
      return;
    }
    if (
      type === 'rental' &&
      (!contactName.trim() || !/^\d{10}$/.test(alternateMobile))
    ) {
      setMessage({
        title: 'Complete the rental contact details',
        text: 'Contact name and a valid 10-digit alternate mobile number are required.',
      });
      return;
    }
    showStep(2);
  }

  function continueFromProducts() {
    if (
      items.length === 0 ||
      items.some(
        (item) => item.item_name.trim().length < 2 || item.quantity < 1,
      )
    ) {
      setMessage({
        title: 'Add order items',
        text: 'Select at least one product, package or custom product.',
      });
      return;
    }
    const form = formRef.current ? new FormData(formRef.current) : null;
    const time = form?.get('event_time');
    setEventTime(typeof time === 'string' ? time : '');
    showStep(3);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const quote = submitter?.value === 'quote';
    if (quoteOnly && !quote) {
      setMessage({
        title: 'Quote-only staff access',
        text: 'Staff IDs can save quotations only. A Main ID must review the quote, take payment and create the order.',
      });
      return;
    }
    if (!type) return;
    if (!selectedCustomer) {
      setMessage({
        title: 'Select a customer',
        text: 'Choose an existing customer or create a new one.',
      });
      return;
    }
    if (
      items.length === 0 ||
      items.some(
        (item) => item.item_name.trim().length < 2 || item.quantity < 1,
      )
    ) {
      setMessage({
        title: 'Add order items',
        text: 'Select at least one product, package or custom product.',
      });
      return;
    }
    if (!quote && paid > total) {
      setMessage({
        title: 'Check the payment',
        text: 'Amount paid cannot be more than the order total.',
      });
      return;
    }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const readText = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const bookingDate = form.get('booking_date');
    const plainNotes = readText('notes');
    const modificationNotes =
      isSale && modificationsRequired
        ? [
            'SALE MODIFICATION REQUIRED',
            `Details: ${readText('modification_details')}`,
            `Modification date: ${readText('modification_date')}`,
            `Modification time: ${readText('modification_time')}`,
          ].join('\n')
        : '';
    const payload = {
      booking_type: type,
      customer_id: selectedCustomer?.id ?? null,
      customer: null,
      event_name: `${eventType} - ${eventFor}`,
      event_date: eventDate,
      event_time: form.get('event_time'),
      event_location: venue,
      contact_name: type === 'rental' ? contactName.trim() : null,
      alternate_mobile: type === 'rental' ? alternateMobile : null,
      pickup_date: type === 'rental' ? form.get('pickup_date') : null,
      due_date: type === 'rental' ? form.get('due_date') : null,
      assigned_staff_id: form.get('assigned_staff_id'),
      notes:
        [plainNotes, modificationNotes].filter(Boolean).join('\n\n') || null,
      items: items.map(
        ({ key: _key, additional_safa: _additionalSafa, ...item }) => item,
      ),
      discount,
      tax,
      paid_amount: quote ? 0 : paid,
      payment_method: form.get('payment_method'),
      payment_reference: null,
    };
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      quote ? 'create_booking_quote' : 'create_booking',
      { payload },
    );
    if (error) {
      setMessage({
        title: quote ? 'Quote was not saved' : 'Order was not created',
        text: error.message,
      });
      setBusy(false);
      return;
    }
    if (typeof bookingDate === 'string' && bookingDate) {
      const { error: dateError } = await supabase
        .from('bookings')
        .update({ created_at: `${bookingDate}T12:00:00+05:30` })
        .eq('id', data.id)
        .select('id')
        .single();
      if (dateError) {
        setMessage({
          title: 'Booking saved, but the date was not updated',
          text: dateError.message,
        });
        setBusy(false);
        return;
      }
    }
    router.push(
      `${quote ? '/quotes' : '/bookings'}?created=${encodeURIComponent(data.booking_number ?? String(data.id))}`,
    );
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[1320px]">
      {!type && (
        <TypeChooser
          onChoose={setType}
          onClose={() => router.push('/bookings')}
        />
      )}
      {customerModalOpen && (
        <NewCustomerDialog
          ownerId={ownerId}
          onClose={() => setCustomerModalOpen(false)}
          onCreated={(customer) => {
            setCustomerList((current) => [customer, ...current]);
            setSelectedCustomer(customer);
            setCustomerSearch('');
            setCustomerModalOpen(false);
          }}
        />
      )}
      <form ref={formRef} onSubmit={submit} className="space-y-5">
        <DashboardHeader
          title={`New ${isSale ? 'Sale' : 'Rental'} Booking`}
          subtitle="Complete the details below to create a live booking"
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                render={<Link href="/bookings" aria-label="All bookings" />}
              >
                <ArrowLeft />
                <span className="hidden xl:inline">All bookings</span>
              </Button>
              <Badge variant="outline" className="h-9 bg-white px-3">
                {isSale ? 'Sale booking' : 'Rental booking'}
              </Badge>
            </>
          }
        />

        <BookingSteps current={step} />

        <section
          id="booking-workflow"
          className="scroll-mt-20 overflow-hidden rounded-2xl border border-[#d9c29e] bg-white shadow-level-2"
        >
          <div className="grid gap-5 bg-[linear-gradient(115deg,#2f2a23_0%,#5d482c_62%,#9a6728_100%)] px-5 py-5 text-white sm:grid-cols-[1fr_auto] sm:items-end lg:px-7">
            <div>
              <p className="text-2xl font-semibold tracking-[-0.04em]">
                SAFAWALA
              </p>
              <p className="mt-1 text-sm text-white/70">
                Premium Wedding Accessories
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[220px_170px_auto] sm:items-end">
              <ReadOnlyField label="Invoice number" value="Generated on save" />
              <EditableDateField
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
              <Badge className="h-9 bg-white/15 px-3 text-white ring-1 ring-white/25">
                <ShoppingBag />
                {isSale ? 'Sale' : 'Rental'}
              </Badge>
            </div>
          </div>

          <div className="bg-[#fbfaf8] p-4 lg:p-6">
            <div hidden={step !== 1} className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
                <Card className="gap-0 border-border py-0 shadow-none ring-0">
                  <CardHeader className="gap-3 border-b bg-[#fcfaf7] px-4 py-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-primary ring-1 ring-[#e4d2b6]">
                        <UserRound className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold">
                          Customer
                        </CardTitle>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          Choose from your customer directory
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 w-full bg-white"
                      onClick={() => setCustomerModalOpen(true)}
                    >
                      <Plus />
                      New customer
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4">
                    <label className="relative block">
                      <span className="sr-only">Search customers</span>
                      <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                      <input
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Search name, phone or email…"
                        className={`${inputClass} pl-9`}
                      />
                    </label>
                    <div className="mt-3 space-y-2">
                      {visibleCustomers.length ? (
                        visibleCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            aria-label={`Select customer ${customer.name}, ${customer.phone}`}
                            onClick={() => setSelectedCustomer(customer)}
                            className={`w-full rounded-xl border p-3 text-left transition ${selectedCustomer?.id === customer.id ? 'border-primary bg-accent shadow-sm' : 'border-border bg-white hover:border-primary/40 hover:bg-[#fcfaf7]'}`}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold">
                                  {customer.name}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {customer.phone}
                                  {customer.email ? ` · ${customer.email}` : ''}
                                </span>
                                {customer.address && (
                                  <span className="mt-1 block truncate text-[11px] text-muted-foreground/80">
                                    {customer.address}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border ${selectedCustomer?.id === customer.id ? 'border-primary bg-primary text-white' : 'border-border text-transparent'}`}
                              >
                                <Check className="size-3" />
                              </span>
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed py-7 text-center">
                          <p className="text-sm font-medium">
                            No customer found
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Try another search or add a new customer.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3"
                            onClick={() => setCustomerModalOpen(true)}
                          >
                            <Plus />
                            Add customer
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Showing {visibleCustomers.length} of{' '}
                        {matchingCustomers.length}
                      </span>
                      {matchingCustomers.length > 5 && (
                        <span>Refine your search to find others</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="gap-0 border-border py-0 shadow-none ring-0">
                  <CardHeader className="border-b px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
                        <CalendarDays className="size-4" />
                      </span>
                      <CardTitle className="text-sm font-semibold">
                        Event details
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-x-4 gap-y-5 p-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-muted-foreground">
                        Event type
                      </span>
                      <select
                        name="event_type"
                        value={eventType}
                        onChange={(event) => setEventType(event.target.value)}
                        className={inputClass}
                        required
                      >
                        <option>Wedding</option>
                        <option>Engagement</option>
                        <option>Reception</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-muted-foreground">
                        For
                      </span>
                      <select
                        name="event_for"
                        value={eventFor}
                        onChange={(event) => setEventFor(event.target.value)}
                        className={inputClass}
                        required
                      >
                        <option>Groom Only</option>
                        <option>Bride Only</option>
                        <option>Bride &amp; Groom</option>
                        <option>Family / Group</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-muted-foreground">
                        Event date <span className="text-red-600">*</span>
                      </span>
                      <input
                        name="event_date"
                        type="date"
                        value={eventDate}
                        onChange={(event) => setEventDate(event.target.value)}
                        className={inputClass}
                        required
                      />
                    </label>
                    <TimeField label="Event time" name="event_time" />
                    <label className="block pt-1 text-sm sm:col-span-2">
                      <span className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-3.5 text-primary" />
                        Venue <span className="text-red-600">*</span>
                      </span>
                      <input
                        name="event_location"
                        value={venue}
                        onChange={(event) => setVenue(event.target.value)}
                        placeholder="Enter complete venue name and address…"
                        className={inputClass}
                        required
                      />
                    </label>
                    {!isSale ? (
                      <>
                        <label className="block text-sm">
                          <span className="mb-1.5 block text-muted-foreground">
                            Contact name <span className="text-red-600">*</span>
                          </span>
                          <input
                            name="contact_name"
                            value={contactName}
                            onChange={(event) =>
                              setContactName(event.target.value)
                            }
                            placeholder="Name of the event contact"
                            autoComplete="off"
                            className={inputClass}
                            required
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="mb-1.5 flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="size-3.5 text-primary" />
                            Alternate mobile number{' '}
                            <span className="text-red-600">*</span>
                          </span>
                          <input
                            name="alternate_mobile"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="off"
                            pattern="[0-9]{10}"
                            maxLength={10}
                            value={alternateMobile}
                            onChange={(event) =>
                              setAlternateMobile(
                                event.target.value
                                  .replace(/\D/g, '')
                                  .slice(0, 10),
                              )
                            }
                            placeholder="Enter 10-digit alternate number"
                            className={inputClass}
                            required
                          />
                        </label>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end border-t pt-5">
                <Button type="button" onClick={continueFromCustomer}>
                  Continue to products
                  <ChevronRight />
                </Button>
              </div>
            </div>

            <div hidden={step !== 2} className="space-y-5">
              <Card className="gap-0 border-border py-0 shadow-none ring-0">
                <CardHeader className="flex flex-col items-start gap-3 border-b px-4 py-4">
                  <div className="flex w-full min-w-0 items-center gap-2">
                    <Box className="size-4" />
                    <CardTitle className="text-sm font-semibold">
                      {isSale
                        ? 'Select products'
                        : rentalSelectionMode === 'individual'
                          ? 'Select individual products'
                          : 'Select a package'}
                    </CardTitle>
                    <Badge variant="outline">
                      {isSale || rentalSelectionMode === 'individual'
                        ? `${visibleProducts.length} products`
                        : `${visibleRentalPackages.length} packages`}
                    </Badge>
                  </div>
                  {(isSale || rentalSelectionMode === 'individual') && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-center sm:w-72"
                      onClick={() =>
                        setItems((current) => [
                          ...current,
                          {
                            key: uid(),
                            item_name: '',
                            quantity: 1,
                            unit_price: 0,
                            security_deposit: 0,
                          },
                        ])
                      }
                    >
                      <Plus />
                      Quick custom product
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  {!isSale ? (
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-muted-foreground">
                        Selection mode
                      </legend>
                      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-[#fcfaf7] p-1.5">
                        <button
                          type="button"
                          aria-pressed={rentalSelectionMode === 'individual'}
                          onClick={() => setRentalSelectionMode('individual')}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${rentalSelectionMode === 'individual' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-white hover:text-foreground'}`}
                        >
                          <Box className="size-4" />
                          Individual products
                        </button>
                        <button
                          type="button"
                          aria-pressed={rentalSelectionMode === 'packages'}
                          onClick={() => setRentalSelectionMode('packages')}
                          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${rentalSelectionMode === 'packages' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-white hover:text-foreground'}`}
                        >
                          <Package className="size-4" />
                          Packages
                        </button>
                      </div>
                    </fieldset>
                  ) : null}
                  {isSale || rentalSelectionMode === 'individual' ? (
                    <>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_210px_210px]">
                        <div className="relative md:col-span-2 xl:col-span-1">
                          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                          <input
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Search products or barcode…"
                            inputMode="search"
                            className={`${inputClass} pl-9 pr-12`}
                          />
                          <button
                            type="button"
                            aria-label="Clear product search"
                            onClick={() => setProductSearch('')}
                            className="absolute right-2 top-1.5 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                          >
                            <Camera className="size-4" />
                          </button>
                        </div>
                        <label>
                          <span className="sr-only">
                            Filter product category
                          </span>
                          <select
                            value={productCategory}
                            onChange={(event) => {
                              setProductCategory(event.target.value);
                              setProductSubcategory('all');
                            }}
                            className={inputClass}
                          >
                            <option value="all">All categories</option>
                            {INVENTORY_CATEGORIES.map((category) => (
                              <option key={category}>{category}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="sr-only">
                            Filter product subcategory
                          </span>
                          <select
                            value={productSubcategory}
                            onChange={(event) =>
                              setProductSubcategory(event.target.value)
                            }
                            className={inputClass}
                          >
                            <option value="all">All subcategories</option>
                            {productSubcategoryOptions.map((subcategory) => (
                              <option key={subcategory}>{subcategory}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {visibleProducts.length ? (
                        <div className="grid max-h-[640px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
                          {visibleProducts.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => addProduct(product)}
                              className="group overflow-hidden rounded-xl border bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-level-1"
                            >
                              <span className="relative grid aspect-square overflow-hidden rounded-lg bg-[radial-gradient(circle_at_top,#f4eadb,#ece5db)] text-primary">
                                {product.image_urls?.[0] ? (
                                  <Image
                                    src={product.image_urls[0]}
                                    alt={product.name}
                                    fill
                                    unoptimized
                                    className="h-full w-full object-contain p-1 transition group-hover:scale-[1.02]"
                                  />
                                ) : (
                                  <Package className="m-auto size-8 transition group-hover:scale-110" />
                                )}
                                {product.category ? (
                                  <Badge
                                    variant="outline"
                                    className="absolute right-2 top-2 max-w-[calc(100%-1rem)] truncate bg-white/95 text-[10px] shadow-sm"
                                  >
                                    {product.category}
                                  </Badge>
                                ) : null}
                              </span>
                              <span className="mt-3 block truncate px-1 text-sm font-semibold">
                                {product.name}
                              </span>
                              <span className="mt-1 flex items-center justify-between gap-2 px-1 pb-1 text-xs text-muted-foreground">
                                <span className="truncate font-mono">
                                  {product.barcode ||
                                    product.sku ||
                                    `${product.stock_quantity} in stock`}
                                </span>
                                <strong className="shrink-0 text-foreground">
                                  {money(
                                    isSale
                                      ? product.sale_price
                                      : product.rental_price,
                                  )}
                                </strong>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <EmptyCatalog />
                      )}
                      {isSale && packages.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Packages
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {packages.map((pack) => (
                              <Button
                                key={pack.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addPackage(pack)}
                              >
                                <Plus />
                                {pack.name} ·{' '}
                                {money(
                                  isSale ? pack.sale_price : pack.rental_price,
                                )}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : rentalPackages.length ? (
                    <div className="space-y-6">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                        <input
                          value={packageSearch}
                          onChange={(event) => setPackageSearch(event.target.value)}
                          placeholder="Search packages or inclusions…"
                          inputMode="search"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                      <section>
                        <div className="mb-3 flex items-center gap-2">
                          <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-semibold text-primary">
                            1
                          </span>
                          <h3 className="text-sm font-semibold">
                            Select package category
                          </h3>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {rentalPackageCategories.map((category) => {
                            const selected = category === selectedRentalCategory;
                            return (
                              <button
                                key={category}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => setSelectedRentalCategory(category)}
                                className={`h-10 rounded-xl border px-4 text-left text-sm font-medium transition ${selected ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-white text-foreground hover:border-primary/40 hover:bg-[#fcfaf7]'}`}
                              >
                                {category}
                              </button>
                            );
                          })}
                        </div>
                      </section>

                      <section className="border-t pt-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 place-items-center rounded-lg bg-accent text-xs font-semibold text-primary">
                              2
                            </span>
                            <h3 className="text-sm font-semibold">
                              Select package variant
                            </h3>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {selectedRentalCategory}
                          </span>
                        </div>
                        {visibleRentalPackages.length ? (
                          <div className="grid max-h-[640px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
                            {visibleRentalPackages.map((pack) => (
                              <button
                                key={pack.id}
                                type="button"
                                aria-pressed={pack.id === selectedRentalPackageId}
                                onClick={() => addRentalPackage(pack)}
                                className={`group overflow-hidden rounded-xl border bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-level-1 ${pack.id === selectedRentalPackageId ? 'border-primary ring-2 ring-primary/20' : ''}`}
                              >
                                <span className="relative grid aspect-square overflow-hidden rounded-lg bg-[radial-gradient(circle_at_top,#f4eadb,#ece5db)] text-primary">
                                  {pack.image_url ? (
                                    <Image
                                      src={pack.image_url}
                                      alt={pack.name}
                                      fill
                                      unoptimized
                                      className="object-contain p-1 transition group-hover:scale-[1.02]"
                                    />
                                  ) : (
                                    <Package className="m-auto size-10 text-primary/35" />
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="absolute right-2 top-2 max-w-[calc(100%-1rem)] truncate bg-white/95 text-[10px] shadow-sm"
                                  >
                                    {pack.category_name}
                                  </Badge>
                                </span>
                                <span className="mt-3 block truncate px-1 text-sm font-semibold">
                                  {pack.name}
                                </span>
                                {pack.inclusions.length ? (
                                  <span className="mt-1 block truncate px-1 text-xs text-muted-foreground">
                                    {pack.inclusions.join(' · ')}
                                  </span>
                                ) : null}
                                <span className="mt-2 flex items-end justify-between gap-2 border-t px-1 pb-1 pt-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    Deposit {money(pack.security_deposit)}
                                  </span>
                                  <strong className="shrink-0 text-sm text-foreground">
                                    {money(pack.rental_price)}
                                  </strong>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed px-4 py-7 text-center">
                            <Package className="mx-auto size-6 text-muted-foreground/60" />
                            <p className="mt-2 text-sm font-medium">
                              No variants in this category
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Add a variant in Package Manager to use it here.
                            </p>
                          </div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-[#d9c29e] bg-[#fcfaf7] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
                                <Package className="size-4" />
                              </span>
                              <h3 className="text-sm font-semibold">
                                Additional Safa
                              </h3>
                              <Badge variant="outline" className="bg-white">
                                {additionalSafaProducts.length} options
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground sm:ml-10">
                              Optional · Select only from Barati Safa inventory.
                            </p>
                          </div>
                          <div className="flex items-center gap-3 rounded-lg border bg-white px-3 py-2 text-xs">
                            <span className="font-medium tabular-nums">
                              {additionalSafaCount} / {packageSafaLimit || '—'} used
                            </span>
                            <span className="h-4 w-px bg-border" />
                            <button
                              type="button"
                              aria-pressed={bypassSafaLimit}
                              onClick={() =>
                                setBypassSafaLimit((current) => !current)
                              }
                              className={`shrink-0 rounded-full px-2.5 py-1 font-medium transition ${bypassSafaLimit ? 'bg-[#9a6728] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/70'}`}
                            >
                              Bypass limit
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px]">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                            <input
                              value={additionalSafaSearch}
                              onChange={(event) =>
                                setAdditionalSafaSearch(event.target.value)
                              }
                              placeholder="Search products or barcode…"
                              inputMode="search"
                              className={`${inputClass} pl-9 pr-12`}
                            />
                            <button
                              type="button"
                              aria-label="Clear additional Safa search"
                              onClick={() => setAdditionalSafaSearch('')}
                              className="absolute right-2 top-1.5 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
                            >
                              <Camera className="size-4" />
                            </button>
                          </div>
                          <label>
                            <span className="sr-only">Barati Safa package</span>
                            <select
                              value={additionalSafaPackage}
                              onChange={(event) => {
                                setAdditionalSafaPackage(event.target.value);
                                setAdditionalSafaProductId('');
                              }}
                              className={inputClass}
                            >
                              <option value="all">All packages</option>
                              {additionalSafaPackages.map((subcategory) => (
                                <option key={subcategory}>{subcategory}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        {additionalSafaProducts.length ? (
                          <div className="mt-3 grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-4">
                            {additionalSafaProducts.map((product) => {
                              const selected = product.id === Number(additionalSafaProductId);
                              return (
                                <button
                                  key={product.id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() =>
                                    setAdditionalSafaProductId(String(product.id))
                                  }
                                  className={`group overflow-hidden rounded-xl border bg-white p-2 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-level-1 ${selected ? 'border-primary ring-2 ring-primary/20' : ''}`}
                                >
                                  <span className="relative grid aspect-square overflow-hidden rounded-lg bg-[radial-gradient(circle_at_top,#f4eadb,#ece5db)] text-primary">
                                    {product.image_urls?.[0] ? (
                                      <Image
                                        src={product.image_urls[0]}
                                        alt={product.name}
                                        fill
                                        unoptimized
                                        className="h-full w-full object-contain p-1 transition group-hover:scale-[1.02]"
                                      />
                                    ) : (
                                      <Package className="m-auto size-8 transition group-hover:scale-110" />
                                    )}
                                    {product.subcategory ? (
                                      <Badge
                                        variant="outline"
                                        className="absolute right-2 top-2 max-w-[calc(100%-1rem)] truncate bg-white/95 text-[10px] shadow-sm"
                                      >
                                        {product.subcategory}
                                      </Badge>
                                    ) : null}
                                  </span>
                                  <span className="mt-3 block truncate px-1 text-sm font-semibold">
                                    {product.name}
                                  </span>
                                  <span className="mt-1 flex items-center justify-between gap-2 px-1 pb-1 text-xs text-muted-foreground">
                                    <span className="truncate font-mono">
                                      {product.barcode || product.sku || ''}
                                    </span>
                                    <strong className="shrink-0 text-foreground">
                                      {money(product.rental_price)}
                                    </strong>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-dashed px-4 py-6 text-center">
                            <Package className="mx-auto size-6 text-muted-foreground/60" />
                            <p className="mt-2 text-sm font-medium">
                              No Barati Safa products match
                            </p>
                          </div>
                        )}
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                          {selectedAdditionalSafaProduct ? (
                            <span className="truncate text-xs text-muted-foreground">
                              Selected: {selectedAdditionalSafaProduct.name}
                            </span>
                          ) : null}
                          <div className="flex items-center gap-2 sm:ml-auto">
                            <label>
                              <span className="sr-only">Additional Safa quantity</span>
                              <input
                                type="number"
                                min="1"
                                value={additionalSafaQuantity}
                                onChange={(event) =>
                                  setAdditionalSafaQuantity(
                                    Math.max(1, Number(event.target.value) || 1),
                                  )
                                }
                                className={`${inputClass} w-24`}
                                aria-label="Additional Safa quantity"
                              />
                            </label>
                            <Button
                              type="button"
                              onClick={addAdditionalSafa}
                              disabled={
                                !selectedRentalPackage || !additionalSafaProductId
                              }
                            >
                              <Plus /> Add Safa
                            </Button>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-2xl border bg-white p-4">
                        <label className="block text-sm">
                          <span className="mb-1.5 flex items-center gap-2 font-medium">
                            <FileText className="size-4 text-primary" /> Notes
                          </span>
                          <textarea
                            name="notes"
                            rows={4}
                            value={rentalNotes}
                            onChange={(event) => setRentalNotes(event.target.value)}
                            placeholder="Any additional notes…"
                            className="w-full resize-y rounded-xl border border-input bg-white p-3 text-sm leading-6 outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
                          />
                        </label>
                      </section>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed px-4 py-8 text-center">
                      <Package className="mx-auto size-7 text-muted-foreground/60" />
                      <p className="mt-2 text-sm font-medium">
                        No rental packages available
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create an active package in Package Manager first.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="gap-0 border-border py-0 shadow-none ring-0">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="border-b bg-[#f5f2ed] text-left text-xs text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 font-medium">Qty</th>
                          <th className="px-4 py-3 font-medium">Rate</th>
                          {!isSale && (
                            <th className="px-4 py-3 font-medium">Deposit</th>
                          )}
                          <th className="px-4 py-3 text-right font-medium">
                            Total
                          </th>
                          <th className="w-12">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length ? (
                          items.map((item) => (
                            <tr
                              key={item.key}
                              className="border-b last:border-0"
                            >
                              <td className="px-4 py-3">
                                <input
                                  value={item.item_name}
                                  onChange={(e) =>
                                    updateItem(item.key, {
                                      item_name: e.target.value,
                                      product_id: undefined,
                                      package_id: undefined,
                                      package_variant_id: undefined,
                                    })
                                  }
                                  aria-label="Item name"
                                  className={inputClass}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItem(item.key, {
                                      quantity: Number(e.target.value),
                                    })
                                  }
                                  aria-label="Quantity"
                                  className={`${inputClass} w-20`}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={item.unit_price}
                                  onChange={(e) =>
                                    updateItem(item.key, {
                                      unit_price: Number(e.target.value),
                                    })
                                  }
                                  aria-label="Rate"
                                  className={`${inputClass} w-28`}
                                />
                              </td>
                              {!isSale && (
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={item.security_deposit}
                                    onChange={(e) =>
                                      updateItem(item.key, {
                                        security_deposit: Number(
                                          e.target.value,
                                        ),
                                      })
                                    }
                                    aria-label="Security deposit"
                                    className={`${inputClass} w-28`}
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3 text-right font-semibold">
                                {money(item.quantity * item.unit_price)}
                              </td>
                              <td className="px-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setItems((current) =>
                                      current.filter(
                                        (row) => row.key !== item.key,
                                      ),
                                    )
                                  }
                                  aria-label={`Remove ${item.item_name || 'item'}`}
                                >
                                  <Trash2 />
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={isSale ? 5 : 6}
                              className="px-4 py-9 text-center"
                            >
                              <Box className="mx-auto size-5 text-muted-foreground/50" />
                              <p className="mt-2 text-sm text-muted-foreground">
                                No items added yet
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Choose products above or add a custom product.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => showStep(1)}
                >
                  <ArrowLeft />
                  Back to customer details
                </Button>
                <Button type="button" onClick={continueFromProducts}>
                  Review booking
                  <ChevronRight />
                </Button>
              </div>
            </div>

            <div hidden={step !== 3} className="space-y-5">
              <Card className="gap-0 border-[#dfc9a6] py-0 shadow-none ring-0">
                <CardHeader className="border-b bg-[#fcfaf7] px-4 py-4">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Check className="size-4 text-primary" />
                    Review booking
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <ReviewDetail
                    label="Customer"
                    value={selectedCustomer?.name || 'Not selected'}
                  />
                  <ReviewDetail
                    label="Phone"
                    value={selectedCustomer?.phone || '—'}
                  />
                  <ReviewDetail
                    label="Event"
                    value={`${eventType} · ${eventFor}`}
                  />
                  <ReviewDetail
                    label="Event date & time"
                    value={`${formatReviewDate(eventDate)}${eventTime ? ` · ${formatReviewTime(eventTime)}` : ''}`}
                  />
                  <div className="sm:col-span-2 lg:col-span-4">
                    <ReviewDetail label="Venue" value={venue || 'Not added'} />
                  </div>
                  {!isSale ? (
                    <>
                      <ReviewDetail
                        label="Contact name"
                        value={contactName || 'Not added'}
                      />
                      <ReviewDetail
                        label="Alternate mobile"
                        value={alternateMobile || 'Not added'}
                      />
                    </>
                  ) : null}
                  <ReviewDetail
                    label="Selected items"
                    value={`${items.reduce((sum, item) => sum + item.quantity, 0)} item${items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'}`}
                  />
                  <ReviewDetail
                    label="Booking type"
                    value={isSale ? 'Sale' : 'Rental'}
                  />
                  <ReviewDetail label="Subtotal" value={money(subtotal)} />
                  <ReviewDetail label="Current total" value={money(total)} />
                </CardContent>
              </Card>

              {!isSale && (
                <Card className="gap-0 border-border py-0 shadow-none ring-0">
                  <CardHeader className="border-b px-4 py-4">
                    <CardTitle className="text-sm font-semibold">
                      Rental schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                    <Field
                      label="Pickup date"
                      name="pickup_date"
                      type="date"
                      required
                    />
                    <Field
                      label="Return due date"
                      name="due_date"
                      type="date"
                      required
                    />
                  </CardContent>
                </Card>
              )}

              {isSale && (
                <Card className="gap-0 border-border py-0 shadow-none ring-0">
                  <CardContent className="p-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={modificationsRequired}
                        onChange={(event) =>
                          setModificationsRequired(event.target.checked)
                        }
                        className="size-4 accent-[#9a6728]"
                      />
                      <Wrench className="size-4 text-primary" />
                      Modifications required
                    </label>
                    {modificationsRequired && (
                      <div className="mt-4 rounded-xl border border-[#e4d2b6] bg-[#fcfaf7] p-4">
                        <label className="block text-sm">
                          <span className="mb-1.5 block font-medium">
                            Modification details{' '}
                            <span className="text-red-600">*</span>
                          </span>
                          <textarea
                            name="modification_details"
                            required
                            rows={3}
                            placeholder="Describe the colour change, size adjustment, embroidery or other work required…"
                            className="w-full rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
                          />
                        </label>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <Field
                            label="Modification date"
                            name="modification_date"
                            type="date"
                            required
                          />
                          <TimeField
                            label="Modification time"
                            name="modification_time"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {!isSale && rentalSelectionMode === 'individual' ? (
                <Card className="gap-0 border-border py-0 shadow-none ring-0">
                  <CardHeader className="border-b bg-[#fcfaf7] px-4 py-4">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
                        <FileText className="size-4" />
                      </span>
                      Rental notes
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Add delivery, handling, fitting or return instructions for
                      this rental.
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium">
                        Notes for this rental
                      </span>
                      <textarea
                        name="notes"
                        rows={4}
                        value={rentalNotes}
                        onChange={(event) => setRentalNotes(event.target.value)}
                        placeholder="Enter delivery instructions, product handling notes, fitting details or return information…"
                        className="w-full resize-y rounded-lg border border-input bg-white p-3 text-sm leading-6 outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
                      />
                    </label>
                  </CardContent>
                </Card>
              ) : isSale ? (
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium">Notes</span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Any additional notes…"
                    className="w-full rounded-lg border border-input bg-white p-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="gap-0 border-border py-0 shadow-none ring-0">
                  <CardHeader className="border-b px-4 py-4">
                    <CardTitle className="text-sm font-semibold">
                      {quoteOnly ? 'Payment details · Main ID only' : 'Payment method & discounts'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4">
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-muted-foreground">
                        Payment method
                      </span>
                      <select name="payment_method" className={inputClass} disabled={quoteOnly}>
                        <option value="cash">Cash / offline payment</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <NumberField
                      label="Discount amount"
                      value={discount}
                      onChange={setDiscount}
                      disabled={quoteOnly}
                    />
                    <NumberField
                      label="Amount paid"
                      value={paid}
                      onChange={setPaid}
                      disabled={quoteOnly}
                    />
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-muted-foreground">
                        Sales staff
                      </span>
                      <select name="assigned_staff_id" className={inputClass} disabled={quoteOnly}>
                        <option value="">Unassigned</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 border-t pt-3 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={taxEnabled}
                        onChange={(e) => setTaxEnabled(e.target.checked)}
                        disabled={quoteOnly}
                        className="size-4 accent-[#9a6728]"
                      />
                      Apply GST (5%)
                    </label>
                  </CardContent>
                </Card>
                <Card className="gap-0 border-[#dfc9a6] py-0 shadow-none ring-0">
                  <CardHeader className="border-b bg-[#fcfaf7] px-4 py-4">
                    <CardTitle className="text-sm font-semibold">
                      Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4">
                    <Amount label="Subtotal" value={subtotal} />
                    <Amount label="Discount" value={-discount} />
                    {taxEnabled && <Amount label="GST (5%)" value={tax} />}
                    {!isSale && (
                      <Amount label="Security deposit" value={deposit} />
                    )}
                    <div className="border-t pt-4">
                      <Amount label="Total amount" value={total} strong />
                    </div>
                    <Amount label="Amount paid" value={paid} tone="success" />
                    <Amount
                      label="Balance due"
                      value={Math.max(total - paid, 0)}
                      tone="danger"
                    />
                  </CardContent>
                </Card>
              </div>

              <Terms />
              <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => showStep(2)}
                >
                  <ArrowLeft />
                  Back to products
                </Button>
                <div className="flex flex-col gap-3 sm:items-end">
                  <p className="text-sm text-muted-foreground">
                    Total:{' '}
                    <strong className="ml-1 text-base text-foreground">
                      {money(total)}
                    </strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {!quoteOnly ? <Button type="button" variant="outline" onClick={() => window.print()}><Printer />Print</Button> : null}
                    <Button
                      type="submit"
                      name="intent"
                      value="quote"
                      variant="outline"
                      disabled={busy}
                    >
                      <FileText />
                      Save as quote
                    </Button>
                    {!quoteOnly ? <Button type="submit" name="intent" value="order" disabled={busy}><Check />{busy ? 'Creating…' : 'Complete order'}</Button> : null}
                  </div>
                </div>
              </div>
            </div>

            {message && (
              <Alert variant="destructive" className="mt-5">
                <AlertTitle>{message.title}</AlertTitle>
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}
          </div>
        </section>
      </form>
    </div>
  );
}

function BookingSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    {
      number: 1,
      label: 'Customer details',
      icon: <UserRound className="size-4" />,
    },
    {
      number: 2,
      label: 'Product selection',
      icon: <ShoppingBag className="size-4" />,
    },
    {
      number: 3,
      label: 'Review & complete',
      icon: <Check className="size-4" />,
    },
  ] as const;

  return (
    <nav
      aria-label="Booking progress"
      className="rounded-xl border bg-white px-3 py-3 shadow-level-1 sm:px-5"
    >
      <ol className="grid grid-cols-3 gap-2">
        {steps.map((item, index) => {
          const complete = item.number < current;
          const active = item.number === current;
          return (
            <li
              key={item.number}
              className="relative flex min-w-0 items-center gap-2 sm:gap-3"
            >
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition sm:size-9 ${complete || active ? 'border-primary bg-primary text-white' : 'border-border bg-[#f7f4ef] text-muted-foreground'}`}
              >
                {complete ? <Check className="size-4" /> : item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Step {item.number}
                </span>
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`mt-0.5 block truncate text-xs font-semibold sm:text-sm ${active ? 'text-primary' : 'text-foreground'}`}
                >
                  {item.label}
                </span>
              </span>
              {index < steps.length - 1 && (
                <span
                  className={`absolute left-[calc(100%-2px)] top-1/2 hidden h-px w-2 -translate-y-1/2 sm:block ${complete ? 'bg-primary' : 'bg-border'}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ReviewDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatReviewDate(value: string) {
  if (!value) return 'Date not selected';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatReviewTime(value: string) {
  const [hourText, minute = '00'] = value.split(':');
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${String(hour % 12 || 12).padStart(2, '0')}:${minute} ${period}`;
}

function TypeChooser({
  onChoose,
  onClose,
}: {
  onChoose: (type: 'sale' | 'rental') => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#211d18]/70 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-labelledby="booking-type-title"
        className="relative m-0 max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[24px] border border-white/40 bg-[#fffdf9] p-6 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.35)] sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 grid size-9 place-items-center rounded-full border bg-white text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-primary ring-1 ring-[#e4d2b6]">
            <FileText className="size-6" />
          </span>
          <h2
            id="booking-type-title"
            className="mt-5 text-2xl font-semibold tracking-[-0.04em]"
          >
            Create new booking
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a transaction type to open the right workflow.
          </p>
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <Choice
            icon={<ShoppingBag />}
            title="Sale"
            note="One-time purchase"
            onClick={() => onChoose('sale')}
          />
          <Choice
            icon={<Package />}
            title="Rental"
            note="With pickup and return"
            onClick={() => onChoose('rental')}
          />
        </div>
      </dialog>
    </div>
  );
}

function NewCustomerDialog({
  ownerId,
  onClose,
  onCreated,
}: {
  ownerId: string;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function saveCustomer(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const formText = (key: string) => {
      const value = form.get(key);
      return typeof value === 'string' ? value.trim() : '';
    };
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError('Your session has expired. Please sign in again.');
      setBusy(false);
      return;
    }
    const { data, error: insertError } = await supabase
      .from('customers')
      .insert({
        owner_id: ownerId,
        name: formText('name'),
        phone: formText('phone'),
        email: null,
        address: formText('address') || null,
        notes: null,
      })
      .select('id,name,phone,email,address')
      .single();
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'A customer with this phone number already exists.'
          : insertError.message,
      );
      setBusy(false);
      return;
    }
    onCreated(data as Customer);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#211d18]/70 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-labelledby="new-customer-title"
        className="relative m-0 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[22px] border border-white/40 bg-[#fffdf9] p-0 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.35)]"
      >
        <div className="flex items-start justify-between border-b bg-[#fcfaf7] px-5 py-5 sm:px-6">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary ring-1 ring-[#e4d2b6]">
              <UserRound className="size-5" />
            </span>
            <div>
              <h2
                id="new-customer-title"
                className="text-lg font-semibold tracking-[-0.03em]"
              >
                Add new customer
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Saved immediately to your secure Supabase customer directory.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close new customer popup"
            className="grid size-9 place-items-center rounded-full border bg-white text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={saveCustomer} className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Customer name" name="name" required />
            <Field label="Phone number" name="phone" type="tel" required />
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1.5 block text-muted-foreground">
                City / address
              </span>
              <textarea
                name="address"
                rows={3}
                placeholder="Enter the complete customer address…"
                className="w-full rounded-lg border border-input bg-white p-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Customer was not saved</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              <Check />
              {busy ? 'Saving customer…' : 'Save customer'}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function Choice({
  icon,
  title,
  note,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border bg-white p-6 text-center transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-level-2"
    >
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-primary ring-1 ring-[#e4d2b6] transition group-hover:bg-primary group-hover:text-white">
        {icon}
      </span>
      <span className="mt-5 block text-sm font-bold uppercase tracking-[0.12em]">
        {title}
      </span>
      <span className="mt-2 block text-sm text-muted-foreground">{note}</span>
      <ChevronRight className="mx-auto mt-4 size-4 text-primary opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
    </button>
  );
}
function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </label>
  );
}
export function TimeField({
  label,
  name,
  required,
  defaultValue = '',
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
}) {
  const [defaultHour = '', defaultMinute = '00'] = defaultValue.split(':');
  const parsedHour = Number(defaultHour);
  const [hour, setHour] = useState(
    defaultHour ? String(parsedHour % 12 || 12).padStart(2, '0') : '',
  );
  const [minute, setMinute] = useState(defaultMinute.slice(0, 2) || '00');
  const [period, setPeriod] = useState(parsedHour >= 12 ? 'PM' : 'AM');
  const hour24 = hour
    ? String((Number(hour) % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')
    : '';

  return (
    <fieldset className="block text-sm">
      <legend className="mb-1.5 block text-muted-foreground">{label}</legend>
      <input
        type="hidden"
        name={name}
        value={hour ? `${hour24}:${minute}` : ''}
      />
      <div className="flex h-10 w-full items-center overflow-hidden rounded-lg border border-input bg-white text-sm tabular-nums transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{label} hour</span>
          <select
            value={hour}
            onChange={(event) => setHour(event.target.value)}
            required={required}
            className="h-9 w-full appearance-none bg-transparent py-0 pl-2 pr-5 text-center font-medium outline-none"
          >
            <option value="">HH</option>
            {Array.from({ length: 12 }, (_, index) =>
              String(index + 1).padStart(2, '0'),
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </label>
        <span
          aria-hidden="true"
          className="pb-0.5 font-semibold text-muted-foreground"
        >
          :
        </span>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{label} minutes</span>
          <select
            value={minute}
            onChange={(event) => setMinute(event.target.value)}
            disabled={!hour}
            className="h-9 w-full appearance-none bg-transparent py-0 pl-2 pr-5 text-center font-medium outline-none disabled:opacity-60"
          >
            {Array.from({ length: 12 }, (_, index) =>
              String(index * 5).padStart(2, '0'),
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </label>
        <label className="relative h-full w-[68px] shrink-0 border-l border-input">
          <span className="sr-only">{label} AM or PM</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            disabled={!hour}
            className="h-full w-full appearance-none bg-[#fcfaf7] py-0 pl-2.5 pr-5 font-semibold text-primary outline-none disabled:opacity-60"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-primary/70" />
        </label>
      </div>
    </fieldset>
  );
}
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-white/60">{label}</p>
      <div className="grid h-9 place-items-center rounded-lg bg-white px-3 text-sm font-medium text-[#2f2a23]">
        {value}
      </div>
    </div>
  );
}
function EditableDateField({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/60">Date</span>
      <input
        name="booking_date"
        type="date"
        required
        defaultValue={defaultValue}
        className="h-9 w-full rounded-lg border-0 bg-white px-3 text-sm font-medium text-[#2f2a23] outline-none ring-offset-2 focus:ring-2 focus:ring-white/60"
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-muted-foreground">{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={inputClass}
      />
    </label>
  );
}
function Amount({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: number;
  strong?: boolean;
  tone?: 'success' | 'danger';
}) {
  return (
    <div
      className={`flex items-center justify-between ${tone === 'success' ? 'text-emerald-700' : tone === 'danger' ? 'text-red-600' : ''}`}
    >
      <span className="text-sm">{label}</span>
      <strong className={strong ? 'text-lg' : 'text-sm'}>{money(value)}</strong>
    </div>
  );
}
function EmptyCatalog() {
  return (
    <div className="rounded-xl border border-dashed bg-white py-9 text-center">
      <Package className="mx-auto size-6 text-muted-foreground/50" />
      <p className="mt-2 text-sm font-medium">
        No products in your catalog yet
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Use Quick custom product now, or add products in Supabase.
      </p>
    </div>
  );
}
function Terms() {
  return (
    <Card className="gap-0 border-border py-0 shadow-none ring-0">
      <CardHeader className="border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          Terms & conditions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-5 text-muted-foreground">
          {BOOKING_TERMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

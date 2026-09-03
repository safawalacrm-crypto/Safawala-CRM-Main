'use client';

import { useState, type ChangeEvent, type SyntheticEvent } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Archive,
  Barcode,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  IndianRupee,
  Layers3,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ListPagination } from '@/components/ui/list-pagination';
import { money } from '@/lib/bookings';
import { createClient } from '@/lib/supabase/client';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export type InventoryProduct = {
  id: number;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  size: string | null;
  color: string | null;
  material: string | null;
  cost_price: number;
  regular_price: number;
  sale_price: number;
  rental_price: number;
  security_deposit: number;
  stock_quantity: number;
  reorder_level: number;
  image_urls: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_variants: InventoryVariant[];
};

type InventoryVariant = {
  id: number;
  name: string;
  size: string | null;
  color: string | null;
  material: string | null;
  stock_quantity: number;
  barcode: string | null;
};

type ProductFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type Step = 'details' | 'photos' | 'pricing' | 'variants' | 'barcode';
type Draft = {
  name: string;
  category: string;
  subcategory: string;
  description: string;
  size: string;
  color: string;
  material: string;
  sku: string;
  costPrice: string;
  regularPrice: string;
  salePrice: string;
  rentalPrice: string;
  securityDeposit: string;
  stock: string;
  reorderLevel: string;
  barcode: string;
};
type VariantDraft = {
  key: string;
  id?: number;
  name: string;
  size: string;
  color: string;
  material: string;
  stock: string;
  barcode: string;
};

const productFields =
  'id,sku,barcode,name,description,category,subcategory,size,color,material,cost_price,regular_price,sale_price,rental_price,security_deposit,stock_quantity,reorder_level,image_urls,is_active,created_at,updated_at,product_variants(id,name,size,color,material,stock_quantity,barcode)';
const fieldClass =
  'mt-1.5 h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20';
const categories = [
  'Safa / Turban',
  'Brooch',
  'Kalgi',
  'Mala',
  'Dupatta / Stole',
  'Wedding Accessory',
  'Other',
];
const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'details', label: 'Product info', icon: <Boxes /> },
  { id: 'photos', label: 'Photos', icon: <ImageIcon /> },
  { id: 'pricing', label: 'Pricing', icon: <IndianRupee /> },
  { id: 'variants', label: 'Variants', icon: <Layers3 /> },
  { id: 'barcode', label: 'Barcode', icon: <Barcode /> },
];
const emptyDraft: Draft = {
  name: '',
  category: '',
  subcategory: '',
  description: '',
  size: '',
  color: '',
  material: '',
  sku: '',
  costPrice: '0',
  regularPrice: '0',
  salePrice: '0',
  rentalPrice: '0',
  securityDeposit: '0',
  stock: '0',
  reorderLevel: '0',
  barcode: '',
};

function draftFromProduct(product: InventoryProduct): Draft {
  return {
    name: product.name,
    category: product.category ?? '',
    subcategory: product.subcategory ?? '',
    description: product.description ?? '',
    size: product.size ?? '',
    color: product.color ?? '',
    material: product.material ?? '',
    sku: product.sku ?? '',
    costPrice: String(product.cost_price ?? 0),
    regularPrice: String(product.regular_price ?? 0),
    salePrice: String(product.sale_price ?? 0),
    rentalPrice: String(product.rental_price ?? 0),
    securityDeposit: String(product.security_deposit ?? 0),
    stock: String(product.stock_quantity ?? 0),
    reorderLevel: String(product.reorder_level ?? 0),
    barcode: product.barcode ?? '',
  };
}

export function InventoryDirectory({
  initialProducts,
  loadError,
}: {
  initialProducts: InventoryProduct[];
  loadError: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(
    null,
  );
  const [dialogStep, setDialogStep] = useState<Step>('details');
  const [message, setMessage] = useState(loadError);
  const [notice, setNotice] = useState('');

  const activeProducts = products.filter((product) => product.is_active);
  const inStock = activeProducts.filter(
    (product) => product.stock_quantity > product.reorder_level,
  ).length;
  const lowStock = activeProducts.filter(
    (product) =>
      product.stock_quantity > 0 &&
      product.stock_quantity <= product.reorder_level,
  ).length;
  const outOfStock = activeProducts.filter(
    (product) => product.stock_quantity === 0,
  ).length;
  const inventoryValue = activeProducts.reduce(
    (total, product) =>
      total + Number(product.sale_price) * product.stock_quantity,
    0,
  );
  const categoryOptions = [
    ...new Set(
      activeProducts
        .map((product) => product.category)
        .filter(Boolean) as string[],
    ),
  ].sort();
  const visibleProducts = (() => {
    const query = search.trim().toLowerCase();
    return activeProducts.filter((product) => {
      const searchable =
        `${product.name} ${product.barcode ?? ''} ${product.sku ?? ''} ${product.category ?? ''}`.toLowerCase();
      const matchesSearch = !query || searchable.includes(query);
      const matchesCategory =
        category === 'all' || product.category === category;
      const matchesStock =
        filter === 'all' ||
        (filter === 'in_stock' &&
          product.stock_quantity > product.reorder_level) ||
        (filter === 'low_stock' &&
          product.stock_quantity > 0 &&
          product.stock_quantity <= product.reorder_level) ||
        (filter === 'out_of_stock' && product.stock_quantity === 0);
      return matchesSearch && matchesCategory && matchesStock;
    });
  })();
  const inventoryPageCount = Math.max(
    1,
    Math.ceil(visibleProducts.length / pageSize),
  );
  const safeInventoryPage = Math.min(page, inventoryPageCount);
  const pagedProducts = visibleProducts.slice(
    (safeInventoryPage - 1) * pageSize,
    safeInventoryPage * pageSize,
  );

  function exportCsv() {
    const headers = [
      'barcode',
      'product_name',
      'category',
      'subcategory',
      'sku',
      'size',
      'color',
      'material',
      'cost_price',
      'regular_price',
      'sale_price',
      'rental_price',
      'security_deposit',
      'stock_quantity',
      'reorder_level',
    ];
    const escape = (value: string | number | null) =>
      `"${String(value ?? '').replaceAll('"', '""')}"`;
    const rows = products.map((product) =>
      [
        product.barcode,
        product.name,
        product.category,
        product.subcategory,
        product.sku,
        product.size,
        product.color,
        product.material,
        product.cost_price,
        product.regular_price,
        product.sale_price,
        product.rental_price,
        product.security_deposit,
        product.stock_quantity,
        product.reorder_level,
      ]
        .map(escape)
        .join(','),
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `safawala-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openNewProduct() {
    setEditingProduct(null);
    setDialogStep('details');
    setDialogOpen(true);
  }

  function openEditProduct(product: InventoryProduct, step: Step = 'details') {
    setEditingProduct(product);
    setDialogStep(step);
    setDialogOpen(true);
  }

  function saved(product: InventoryProduct, wasEditing: boolean) {
    setProducts((current) =>
      wasEditing
        ? current.map((item) => (item.id === product.id ? product : item))
        : [product, ...current],
    );
    setDialogOpen(false);
    setMessage('');
    setNotice(
      wasEditing
        ? `${product.name} was updated successfully.`
        : `${product.name} was added to inventory.`,
    );
  }

  return (
    <div className="mx-auto max-w-[1540px] space-y-6">
      {lowStock + outOfStock > 0 ? (
        <button
          type="button"
          onClick={() => {
            setFilter(outOfStock ? 'out_of_stock' : 'low_stock');
            setPage(1);
          }}
          className="flex w-full items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left shadow-level-1 transition hover:border-amber-300"
        >
          <span className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <span>
              <strong className="block text-sm text-amber-950">
                Stock attention required · {lowStock + outOfStock} products
              </strong>
              <span className="mt-0.5 block text-xs text-amber-800">
                {outOfStock} out of stock and {lowStock} at or below their
                reorder level.
              </span>
            </span>
          </span>
          <span className="hidden rounded-md bg-white px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-amber-200 sm:block">
            Review items
          </span>
        </button>
      ) : null}

      <DashboardHeader
        title="Inventory"
        subtitle="Products, pricing, stock & 11-digit barcodes"
        actions={
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={exportCsv}
              className="bg-white"
            >
              <Download />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button type="button" size="sm" onClick={openNewProduct}>
              <Plus />
              <span className="hidden sm:inline">Add product</span>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={<Boxes />}
          label="Total products"
          value={activeProducts.length.toLocaleString('en-IN')}
          note="Active catalog"
        />
        <Metric
          icon={<PackageCheck />}
          label="In stock"
          value={inStock.toLocaleString('en-IN')}
          note="Above reorder level"
          tone="success"
        />
        <Metric
          icon={<AlertTriangle />}
          label="Low stock"
          value={lowStock.toLocaleString('en-IN')}
          note="Reorder soon"
          tone="warning"
        />
        <Metric
          icon={<Archive />}
          label="Out of stock"
          value={outOfStock.toLocaleString('en-IN')}
          note="Needs restocking"
          tone="danger"
        />
        <Metric
          icon={<IndianRupee />}
          label="Inventory value"
          value={money(inventoryValue)}
          note="Sale price × stock"
        />
      </div>

      {message ? (
        <Alert variant="destructive">
          <AlertTitle>Inventory could not be loaded</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {notice ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <Check className="text-emerald-700" />
          <AlertTitle>Inventory updated</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
        <CardContent className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_210px_190px]">
            <label className="relative block">
              <span className="sr-only">Search inventory</span>
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search product, barcode or SKU…"
                className={`${fieldClass} mt-0 pl-9`}
              />
            </label>
            <label>
              <span className="sr-only">Filter category</span>
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
                className={`${fieldClass} mt-0`}
              >
                <option value="all">All categories</option>
                {categoryOptions.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter stock status</span>
              <select
                value={filter}
                onChange={(event) => {
                  setFilter(event.target.value as ProductFilter);
                  setPage(1);
                }}
                className={`${fieldClass} mt-0`}
              >
                <option value="all">All stock levels</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-xl border bg-white shadow-level-1">
        <ListPagination
          total={visibleProducts.length}
          page={safeInventoryPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          itemLabel="products"
        />
        <div className="flex items-center justify-end px-5 py-2.5">
        <Badge variant="outline" className="bg-white">
          <Barcode />
          11-digit barcode ready
        </Badge>
        </div>
      </div>

      {visibleProducts.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {pagedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => openEditProduct(product)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed py-14 text-center shadow-none ring-0">
          <CardContent>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
              <Boxes />
            </span>
            <h3 className="mt-4 font-semibold">No products found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Adjust your filters or add the first product to this catalog.
            </p>
            <Button type="button" className="mt-5" onClick={openNewProduct}>
              <Plus />
              Add product
            </Button>
          </CardContent>
        </Card>
      )}
      {dialogOpen ? (
        <ProductDialog
          product={editingProduct ?? undefined}
          initialStep={dialogStep}
          onClose={() => setDialogOpen(false)}
          onSaved={saved}
        />
      ) : null}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colors =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 ring-amber-200'
        : tone === 'danger'
          ? 'bg-red-50 text-red-700 ring-red-200'
          : 'bg-accent text-primary ring-[#e4d2b6]';
  return (
    <Card className="gap-0 border-border py-0 shadow-level-1 ring-0">
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-semibold tracking-[-0.03em]">
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{note}</p>
        </div>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 [&_svg]:size-4 ${colors}`}
        >
          {icon}
        </span>
      </CardContent>
    </Card>
  );
}

function ProductCard({
  product,
  onEdit,
}: {
  product: InventoryProduct;
  onEdit: () => void;
}) {
  const low =
    product.stock_quantity > 0 &&
    product.stock_quantity <= product.reorder_level;
  const status =
    product.stock_quantity === 0
      ? 'Out of stock'
      : low
        ? 'Low stock'
        : 'In stock';
  const statusClass =
    product.stock_quantity === 0
      ? 'border-red-200 bg-red-50 text-red-700'
      : low
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <Card className="group gap-0 border-border py-0 shadow-level-1 ring-0 transition hover:-translate-y-0.5 hover:shadow-level-2">
      <div className="relative h-52 overflow-hidden bg-[radial-gradient(circle_at_top,#f4eadb,#e8dfd2)]">
        {product.image_urls?.[0] ? (
          <Image
            src={product.image_urls[0]}
            alt={product.name}
            fill
            unoptimized
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Boxes className="size-12 text-primary/30" />
          </div>
        )}
        <Badge variant="outline" className="absolute left-3 top-3 bg-white/95">
          {product.category || 'Uncategorised'}
        </Badge>
      </div>
      <CardContent className="space-y-4 p-4">
        <div>
          <h3 className="truncate text-base font-semibold">{product.name}</h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {product.subcategory ||
              [product.color, product.material].filter(Boolean).join(' · ') ||
              'Product catalog item'}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={statusClass}>
            {status}
          </Badge>
          <span className="text-xs font-semibold">
            {product.stock_quantity} units
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-[#fcfaf7] p-3 text-xs">
          <span className="text-muted-foreground">
            Rental
            <strong className="mt-1 block text-sm text-foreground">
              {money(product.rental_price)}
            </strong>
          </span>
          <span className="text-right text-muted-foreground">
            Sale
            <strong className="mt-1 block text-sm text-foreground">
              {money(product.sale_price)}
            </strong>
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Stock value · {money(product.sale_price)} × {product.stock_quantity}
          </span>
          <strong>
            {money(Number(product.sale_price) * product.stock_quantity)}
          </strong>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#f7f4ef] px-3 py-2 font-mono text-xs text-[#70481c]">
          <Barcode className="size-4 shrink-0" />
          <span className="truncate">
            {product.barcode || product.sku || 'Barcode pending'}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full bg-white"
          onClick={onEdit}
        >
          <Pencil />
          Edit product details
        </Button>
      </CardContent>
    </Card>
  );
}

function ProductDialog({
  product,
  initialStep,
  onClose,
  onSaved,
}: {
  product?: InventoryProduct;
  initialStep: Step;
  onClose: () => void;
  onSaved: (product: InventoryProduct, wasEditing: boolean) => void;
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [draft, setDraft] = useState<Draft>(() =>
    product ? draftFromProduct(product) : emptyDraft,
  );
  const [files, setFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (product?.product_variants ?? []).map((variant) => ({
      id: variant.id,
      key: String(variant.id),
      name: variant.name,
      size: variant.size ?? '',
      color: variant.color ?? '',
      material: variant.material ?? '',
      stock: String(variant.stock_quantity),
      barcode: variant.barcode ?? '',
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stepIndex = steps.findIndex((item) => item.id === step);
  const barcodeValid = /^\d{11}$/.test(draft.barcode);
  const set = (field: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files ?? [])].filter(
      (file) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
        file.size <= 10 * 1024 * 1024,
    );
    setFiles((current) => [...current, ...selected].slice(0, 10));
    event.target.value = '';
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        name: '',
        size: '',
        color: '',
        material: '',
        stock: '0',
        barcode: '',
      },
    ]);
  }

  function updateVariant(
    key: string,
    field: keyof Omit<VariantDraft, 'key'>,
    value: string,
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.key === key ? { ...variant, [field]: value } : variant,
      ),
    );
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (draft.name.trim().length < 2) {
      setStep('details');
      setError('Enter a product name with at least 2 characters.');
      return;
    }
    if (!draft.category) {
      setStep('details');
      setError('Select a product category.');
      return;
    }
    if (!barcodeValid) {
      setStep('barcode');
      setError('The main barcode must contain exactly 11 digits.');
      return;
    }
    if (
      variants.some(
        (variant) =>
          variant.name.trim().length < 2 ||
          (variant.barcode && !/^\d{11}$/.test(variant.barcode)),
      )
    ) {
      setStep('variants');
      setError(
        'Each variant needs a name, and any variant barcode must contain exactly 11 digits.',
      );
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError('Your session has expired. Please sign in again.');
      setBusy(false);
      return;
    }

    const imageUrls: string[] = [...(product?.image_urls ?? [])];
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError(`Photo upload failed: ${uploadError.message}`);
        setBusy(false);
        return;
      }
      imageUrls.push(
        supabase.storage.from('product-images').getPublicUrl(path).data
          .publicUrl,
      );
    }

    const number = (value: string) => Math.max(Number(value) || 0, 0);
    const productValues = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      category: draft.category,
      subcategory: draft.subcategory.trim() || null,
      size: draft.size.trim() || null,
      color: draft.color.trim() || null,
      material: draft.material.trim() || null,
      sku: draft.sku.trim() || draft.barcode,
      barcode: draft.barcode,
      cost_price: number(draft.costPrice),
      regular_price: number(draft.regularPrice),
      sale_price: number(draft.salePrice),
      rental_price: number(draft.rentalPrice),
      security_deposit: number(draft.securityDeposit),
      stock_quantity: Math.floor(number(draft.stock)),
      reorder_level: Math.floor(number(draft.reorderLevel)),
      image_urls: imageUrls,
      is_active: true,
    };
    const productQuery = product
      ? supabase.from('products').update(productValues).eq('id', product.id)
      : supabase.from('products').insert({
          owner_id: auth.user.id,
          ...productValues,
        });
    const { data, error: saveError } = await productQuery
      .select(productFields)
      .single();

    if (saveError) {
      setError(
        saveError.code === '23505'
          ? 'This barcode or SKU is already assigned to another product.'
          : saveError.message.includes('column') ||
              saveError.code === 'PGRST204'
            ? 'The Supabase inventory migration has not been applied yet. Add the inventory columns before saving products.'
            : saveError.message,
      );
      setBusy(false);
      return;
    }

    const variantValues = (variant: VariantDraft) => ({
      owner_id: auth.user!.id,
      product_id: data.id,
      name: variant.name.trim(),
      size: variant.size.trim() || null,
      color: variant.color.trim() || null,
      material: variant.material.trim() || null,
      stock_quantity: Math.floor(number(variant.stock)),
      barcode: variant.barcode || null,
    });

    const existingVariants = variants.filter(
      (variant): variant is VariantDraft & { id: number } =>
        typeof variant.id === 'number',
    );
    const newVariants = variants.filter(
      (variant) => typeof variant.id !== 'number',
    );

    for (const variant of existingVariants) {
      const { error: updateVariantError } = await supabase
        .from('product_variants')
        .update(variantValues(variant))
        .eq('id', variant.id)
        .eq('product_id', data.id);
      if (updateVariantError) {
        setError(
          `Product saved, but variants need attention: ${updateVariantError.message}`,
        );
        setBusy(false);
        return;
      }
    }

    if (newVariants.length) {
      const { error: insertVariantError } = await supabase
        .from('product_variants')
        .insert(newVariants.map(variantValues));
      if (insertVariantError) {
        setError(
          `Product saved, but variants need attention: ${insertVariantError.message}`,
        );
        setBusy(false);
        return;
      }
    }

    if (product) {
      const keptIds = variants
        .map((variant) => variant.id)
        .filter((id): id is number => typeof id === 'number');
      let deleteQuery = supabase
        .from('product_variants')
        .delete()
        .eq('product_id', data.id);
      if (keptIds.length) deleteQuery = deleteQuery.not('id', 'in', `(${keptIds.join(',')})`);
      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        setError(`Product saved, but removed variants need attention: ${deleteError.message}`);
        setBusy(false);
        return;
      }
    }

    const { data: refreshedProduct, error: refreshError } = await supabase
      .from('products')
      .select(productFields)
      .eq('id', data.id)
      .single();
    if (refreshError) {
      setError(`Product saved, but could not be refreshed: ${refreshError.message}`);
      setBusy(false);
      return;
    }
    onSaved(refreshedProduct as InventoryProduct, Boolean(product));
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[#211d18]/70 p-3 backdrop-blur-sm sm:p-5">
      <dialog
        open
        aria-labelledby="product-dialog-title"
        className="relative m-0 flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/40 bg-[#fffdf9] p-0 text-foreground shadow-[0_32px_90px_rgb(20_15_10_/.4)]"
      >
        <div className="flex items-start justify-between border-b bg-[#fcfaf7] px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {product ? 'Inventory update' : 'Inventory setup'}
            </p>
            <h2
              id="product-dialog-title"
              className="mt-1 text-xl font-semibold tracking-[-0.03em]"
            >
              {product ? 'Edit product' : 'Add new product'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {product
                ? 'Update the product details used across inventory and bookings.'
                : 'Complete every detail now so the product is ready for billing and barcode search.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={
              product ? 'Close edit product popup' : 'Close add product popup'
            }
            className="grid size-9 place-items-center rounded-full border bg-white text-muted-foreground transition hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="border-b bg-white px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label="Product setup steps"
            className="grid grid-cols-5 gap-1 rounded-xl bg-[#f3efe9] p-1"
          >
            {steps.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={step === item.id}
                onClick={() => setStep(item.id)}
                className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-2 text-xs font-medium transition [&_svg]:size-3.5 ${step === item.id ? 'bg-white text-[#70481c] shadow-sm ring-1 ring-[#e4d2b6]' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="hidden sm:inline-flex">{item.icon}</span>
                <span className="hidden md:inline">{item.label}</span>
                <span className="md:hidden">{index + 1}</span>
              </button>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {step === 'details' ? (
              <DetailsStep draft={draft} set={set} />
            ) : null}
            {step === 'photos' ? (
              <PhotosStep
                files={files}
                choosePhotos={choosePhotos}
                remove={(index) =>
                  setFiles((current) =>
                    current.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
              />
            ) : null}
            {step === 'pricing' ? (
              <PricingStep draft={draft} set={set} />
            ) : null}
            {step === 'variants' ? (
              <VariantsStep
                variants={variants}
                add={addVariant}
                update={updateVariant}
                remove={(key) =>
                  setVariants((current) =>
                    current.filter((variant) => variant.key !== key),
                  )
                }
              />
            ) : null}
            {step === 'barcode' ? (
              <BarcodeStep draft={draft} set={set} valid={barcodeValid} />
            ) : null}
            {error ? (
              <Alert variant="destructive" className="mt-5">
                <AlertTitle>Product was not saved</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-3 border-t bg-[#fcfaf7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs text-muted-foreground">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(steps[stepIndex - 1].id)}
                >
                  <ChevronLeft />
                  Back
                </Button>
              ) : null}
              {stepIndex < steps.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep(steps[stepIndex + 1].id)}
                >
                  Continue
                  <ChevronRight />
                </Button>
              ) : (
                <Button type="submit" disabled={busy || !barcodeValid}>
                  <Check />
                  {busy
                    ? product
                      ? 'Saving changes…'
                      : 'Creating product…'
                    : product
                      ? 'Save changes'
                      : 'Create product'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </dialog>
    </div>
  );
}

function DetailsStep({
  draft,
  set,
}: {
  draft: Draft;
  set: (field: keyof Draft, value: string) => void;
}) {
  return (
    <section>
      <StepHeading
        icon={<Boxes />}
        title="Product information"
        note="The details staff will use to recognise and search this item."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Product name"
          required
          value={draft.name}
          onChange={(value) => set('name', value)}
          placeholder="e.g. Royal Kundan Brooch"
          className="sm:col-span-2"
        />
        <SelectField
          label="Category"
          required
          value={draft.category}
          onChange={(value) => set('category', value)}
          options={categories}
        />
        <Field
          label="Subcategory"
          value={draft.subcategory}
          onChange={(value) => set('subcategory', value)}
          placeholder="e.g. Bridal collection"
        />
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium">Description</span>
          <textarea
            rows={4}
            value={draft.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Product design, finish and handling notes…"
            className="mt-1.5 w-full rounded-lg border border-input bg-white p-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </label>
        <Field
          label="Size"
          value={draft.size}
          onChange={(value) => set('size', value)}
          placeholder="e.g. Free size"
        />
        <Field
          label="Colour"
          value={draft.color}
          onChange={(value) => set('color', value)}
          placeholder="e.g. Antique gold"
        />
        <Field
          label="Material"
          value={draft.material}
          onChange={(value) => set('material', value)}
          placeholder="e.g. Kundan, brass"
        />
        <Field
          label="Internal SKU (optional)"
          value={draft.sku}
          onChange={(value) => set('sku', value)}
          placeholder="Uses barcode if left blank"
        />
      </div>
    </section>
  );
}

function PhotosStep({
  files,
  choosePhotos,
  remove,
}: {
  files: File[];
  choosePhotos: (event: ChangeEvent<HTMLInputElement>) => void;
  remove: (index: number) => void;
}) {
  return (
    <section>
      <StepHeading
        icon={<ImageIcon />}
        title="Product photos"
        note="Add up to 10 clear photos. The first photo becomes the catalog cover."
      />
      <label
        aria-label="Choose product photos"
        className="mt-6 grid min-h-44 cursor-pointer place-items-center rounded-2xl border border-dashed border-[#d6c5ad] bg-[#fcfaf7] p-6 text-center transition hover:border-primary hover:bg-accent/40"
      >
        <span>
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-primary">
            <Upload />
          </span>
          <strong className="mt-3 block text-sm">
            Choose photos or drag them here
          </strong>
          <span className="mt-1 block text-xs text-muted-foreground">
            JPG, PNG or WebP · maximum 10MB each · {files.length}/10 selected
          </span>
        </span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={choosePhotos}
          className="sr-only"
        />
      </label>
      {files.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-xl border bg-white p-3"
            >
              <span className="grid size-9 place-items-center rounded-lg bg-accent text-primary">
                <ImageIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs">{file.name}</strong>
                <span className="text-[11px] text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                  {index === 0 ? ' · Cover photo' : ''}
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${file.name}`}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PricingStep({
  draft,
  set,
}: {
  draft: Draft;
  set: (field: keyof Draft, value: string) => void;
}) {
  return (
    <section>
      <StepHeading
        icon={<IndianRupee />}
        title="Pricing"
        note="Sale price × stock quantity gives the inventory value. Rental price is used for rental bookings."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Cost price"
          value={draft.costPrice}
          onChange={(value) => set('costPrice', value)}
        />
        <NumberField
          label="Regular price (MRP)"
          value={draft.regularPrice}
          onChange={(value) => set('regularPrice', value)}
        />
        <NumberField
          label="Sale price"
          value={draft.salePrice}
          onChange={(value) => set('salePrice', value)}
        />
        <NumberField
          label="Rental price"
          value={draft.rentalPrice}
          onChange={(value) => set('rentalPrice', value)}
        />
        <NumberField
          label="Security deposit"
          value={draft.securityDeposit}
          onChange={(value) => set('securityDeposit', value)}
        />
      </div>
      <div className="mt-6 grid gap-3 rounded-xl border bg-[#fcfaf7] p-4 sm:grid-cols-4">
        <PriceSummary
          label="Stock value"
          value={String(
            (Number(draft.salePrice) || 0) * (Number(draft.stock) || 0),
          )}
        />
        <PriceSummary label="Sale price" value={draft.salePrice} />
        <PriceSummary label="Rental price" value={draft.rentalPrice} />
        <PriceSummary label="Deposit" value={draft.securityDeposit} />
      </div>
    </section>
  );
}

function VariantsStep({
  variants,
  add,
  update,
  remove,
}: {
  variants: VariantDraft[];
  add: () => void;
  update: (
    key: string,
    field: keyof Omit<VariantDraft, 'key'>,
    value: string,
  ) => void;
  remove: (key: string) => void;
}) {
  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <StepHeading
          icon={<Layers3 />}
          title="Product variants"
          note="Optional sizes, colours or materials that belong to this product."
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus />
          Add variant
        </Button>
      </div>
      {variants.length ? (
        <div className="mt-6 space-y-4">
          {variants.map((variant, index) => (
            <div key={variant.key} className="rounded-2xl border bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <strong className="text-sm">Variant {index + 1}</strong>
                <button
                  type="button"
                  onClick={() => remove(variant.key)}
                  aria-label={`Remove variant ${index + 1}`}
                  className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label="Variant name"
                  required
                  value={variant.name}
                  onChange={(value) => update(variant.key, 'name', value)}
                  placeholder="e.g. Red XL"
                />
                <Field
                  label="Size"
                  value={variant.size}
                  onChange={(value) => update(variant.key, 'size', value)}
                  placeholder="e.g. XL"
                />
                <Field
                  label="Colour"
                  value={variant.color}
                  onChange={(value) => update(variant.key, 'color', value)}
                  placeholder="e.g. Maroon"
                />
                <Field
                  label="Material"
                  value={variant.material}
                  onChange={(value) => update(variant.key, 'material', value)}
                  placeholder="e.g. Silk"
                />
                <NumberField
                  label="Stock"
                  value={variant.stock}
                  onChange={(value) => update(variant.key, 'stock', value)}
                  currency={false}
                />
                <Field
                  label="11-digit barcode (optional)"
                  value={variant.barcode}
                  onChange={(value) =>
                    update(
                      variant.key,
                      'barcode',
                      value.replace(/\D/g, '').slice(0, 11),
                    )
                  }
                  inputMode="numeric"
                  placeholder="00000000000"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed bg-[#fcfaf7] p-10 text-center">
          <Layers3 className="mx-auto size-8 text-primary/40" />
          <h3 className="mt-3 text-sm font-semibold">No variants needed?</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            You can skip this step. Add variants only when one product has
            separate sizes, colours or stock.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={add}
          >
            <Plus />
            Add first variant
          </Button>
        </div>
      )}
    </section>
  );
}

function BarcodeStep({
  draft,
  set,
  valid,
}: {
  draft: Draft;
  set: (field: keyof Draft, value: string) => void;
  valid: boolean;
}) {
  return (
    <section>
      <StepHeading
        icon={<Barcode />}
        title="Stock & main barcode"
        note="This 11-digit number is the permanent key for scanning, search and future bulk imports."
      />
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.25fr]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <NumberField
            label="Available stock"
            value={draft.stock}
            onChange={(value) => set('stock', value)}
            currency={false}
          />
          <NumberField
            label="Reorder level"
            value={draft.reorderLevel}
            onChange={(value) => set('reorderLevel', value)}
            currency={false}
          />
        </div>
        <div
          className={`rounded-2xl border p-5 ${valid ? 'border-emerald-200 bg-emerald-50/60' : 'border-[#e4d2b6] bg-[#fcfaf7]'}`}
        >
          <label className="block">
            <span className="flex items-center justify-between text-sm font-semibold">
              <span>
                Main 11-digit barcode <span className="text-red-600">*</span>
              </span>
              <span
                className={valid ? 'text-emerald-700' : 'text-muted-foreground'}
              >
                {draft.barcode.length}/11
              </span>
            </span>
            <div className="relative mt-3">
              <Barcode className="absolute left-4 top-3.5 size-5 text-primary" />
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{11}"
                minLength={11}
                maxLength={11}
                value={draft.barcode}
                onChange={(event) =>
                  set(
                    'barcode',
                    event.target.value.replace(/\D/g, '').slice(0, 11),
                  )
                }
                placeholder="00000000000"
                className="h-12 w-full rounded-xl border border-input bg-white pl-12 pr-4 font-mono text-lg tracking-[0.16em] outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </label>
          <div className="mt-4 flex items-start gap-2 text-xs">
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full ${valid ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}
            >
              {valid ? (
                <Check className="size-3" />
              ) : (
                <ShieldCheck className="size-3" />
              )}
            </span>
            <p className={valid ? 'text-emerald-800' : 'text-muted-foreground'}>
              {valid
                ? 'Valid barcode. It will be unique inside your Safawala inventory.'
                : 'Enter exactly 11 numbers. Letters, spaces and duplicate codes are not accepted.'}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#e4d2b6] bg-accent/50 p-4">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Future import ready.</strong> Your
          inventory spreadsheet can use this same barcode as its primary
          matching field, so thousands of existing products can be validated and
          added consistently.
        </p>
      </div>
    </section>
  );
}

function StepHeading({
  icon,
  title,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary ring-1 ring-[#e4d2b6] [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  className = '',
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputMode?: 'numeric';
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        className={fieldClass}
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
  currency = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <span className="relative block">
        {currency ? (
          <IndianRupee className="absolute left-3 top-4 size-3.5 text-muted-foreground" />
        ) : null}
        <input
          type="number"
          min="0"
          step={currency ? '0.01' : '1'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClass} ${currency ? 'pl-8' : ''}`}
        />
      </span>
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        <option value="">Select category</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
function PriceSummary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-base">
        {money(Number(value) || 0)}
      </strong>
    </div>
  );
}

export type EntityId = string;
export type ISODateString = string;
export type ISODateOnlyString = string;

export type UserRole = "admin" | "user";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentMethod =
  | "card"
  | "bank_transfer"
  | "cash_on_delivery"
  | "wallet";

export type PaymentStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded";

export type ShippingStatus =
  | "pending"
  | "packed"
  | "in_transit"
  | "delivered"
  | "returned";

export interface User {
  id: EntityId;
  fullName: string;
  email: string;
  passwordHash: string;
  phoneNumber: string;
  address: string;
  role: UserRole;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Admin {
  id: EntityId;
  userId: EntityId;
}

export interface Customer {
  id: EntityId;
  userId: EntityId;
  shippingAddress: string;
  billingAddress: string;
}

export interface AuthUserProfile {
  id: EntityId;
  firebaseUid: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  role: UserRole;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface Category {
  id: EntityId;
  name: string;
  parentCategoryId: EntityId | null;
}

export interface Brand {
  id: EntityId;
  name: string;
  logoUrl: string;
}

export interface Product {
  id: EntityId;
  categoryId: EntityId;
  brandId: EntityId;
  name: string;
  description: string;
  type: string;
  images: string[];
  deletedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ProductVariant {
  id: EntityId;
  productId: EntityId;
  sku: string;
  color: string;
  size: string;
  price: number;
  discountPrice: number | null;
  stockQuantity: number;
}

export interface ProductVariantInput {
  id?: EntityId;
  sku: string;
  color: string;
  size: string;
  price: number;
  discountPrice?: number | null;
  stockQuantity: number;
}

export interface Cart {
  id: EntityId;
  userId: EntityId | null;
  sessionId: string | null;
  totalAmount: number;
  updatedAt: ISODateString;
}

export interface CartItem {
  id: EntityId;
  cartId: EntityId;
  productVariantId: EntityId;
  quantity: number;
  pricePerUnit: number;
}

export interface CartItemRecord extends CartItem {
  productId: EntityId;
  productName: string;
  productType: string;
  productImage: string;
  variantColor: string;
  variantSize: string;
  addedAt: ISODateString;
  lineTotal: number;
}

export interface CartRecord extends Cart {
  items: CartItemRecord[];
  itemCount: number;
}

export interface FavoriteEntry {
  id: EntityId;
  productId: EntityId;
  addedAt: ISODateString;
  product?: ProductRecord;
}

export interface FavoriteRecord {
  id: EntityId;
  userId: EntityId;
  items: FavoriteEntry[];
  updatedAt: ISODateString;
  count: number;
}

export interface Order {
  id: EntityId;
  customerId: EntityId;
  orderNumber: string;
  shippingAddress: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrderItem {
  id: EntityId;
  orderId: EntityId;
  productVariantId: EntityId;
  quantity: number;
  pricePerUnit: number;
  discountAmount: number;
}

export interface Payment {
  id: EntityId;
  orderId: EntityId;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  paymentDate: ISODateString | null;
}

export interface Shipping {
  id: EntityId;
  orderId: EntityId;
  courierName: string;
  trackingNumber: string;
  status: ShippingStatus;
}

export interface Review {
  id: EntityId;
  customerId: EntityId;
  productId: EntityId;
  rating: number;
  comment: string;
  createdAt: ISODateString;
}

export interface SalesStatistic {
  id: EntityId;
  reportDate: ISODateOnlyString;
  totalRevenue: number;
  totalOrders: number;
  totalProductsSold: number;
  calculatedAt: ISODateString;
}

export interface ProductRecord extends Product {
  variants: ProductVariant[];
  brand?: Brand;
  category?: Category;
}

export interface OrderRecord extends Order {
  items: OrderItem[];
  payment?: Payment | null;
  shipping?: Shipping | null;
}

export interface ProductFilters {
  categoryId?: EntityId;
  brandId?: EntityId;
  search?: string;
  featured?: boolean;
}

export type ProductAvailabilityFilter =
  | "all"
  | "available"
  | "limited"
  | "soldout";

export type ProductSortOption =
  | "newest"
  | "price-asc"
  | "price-desc"
  | "name-asc";

export interface ProductFacetOption {
  id: string;
  label: string;
  count: number;
}

export interface ProductPriceRange {
  min: number;
  max: number;
}

export interface ProductDiscoveryQuery {
  search?: string;
  category?: string;
  brand?: string;
  size?: string;
  availability?: ProductAvailabilityFilter;
  priceMin?: number;
  priceMax?: number;
  sort?: ProductSortOption;
}

export interface ProductDiscoveryFacets {
  categories: ProductFacetOption[];
  brands: ProductFacetOption[];
  sizes: ProductFacetOption[];
  availability: ProductFacetOption[];
  priceRange: ProductPriceRange;
}

export interface ProductDiscoveryAppliedQuery {
  search?: string;
  category?: string;
  brand?: string;
  size?: string;
  availability: ProductAvailabilityFilter;
  priceMin?: number;
  priceMax?: number;
  sort: ProductSortOption;
}

export interface ProductDiscoveryResponse {
  items: ProductRecord[];
  facets: ProductDiscoveryFacets;
  total: number;
  applied: ProductDiscoveryAppliedQuery;
}

export interface CreateProductPayload {
  categoryId: EntityId;
  brandId: EntityId;
  name: string;
  description: string;
  type: string;
  images: string[];
  variants: ProductVariantInput[];
}

export interface UpdateProductPayload extends Partial<CreateProductPayload> {}

export interface CreateOrderPayload {
  shippingAddress: string;
  items: Array<{
    productVariantId: EntityId;
    quantity: number;
  }>;
  paymentMethod: PaymentMethod;
}

export interface UpdateOrderPayload {
  status?: OrderStatus;
  shippingStatus?: ShippingStatus;
  paymentStatus?: PaymentStatus;
  trackingNumber?: string;
  courierName?: string;
}

export interface SyncAuthSessionPayload {
  fullName?: string;
  phoneNumber?: string;
  address?: string;
}

export interface UpdateUserProfilePayload {
  fullName?: string;
  phoneNumber?: string;
  address?: string;
}

export interface AuthSession {
  user: AuthUserProfile;
}

export interface AddCartItemPayload {
  productVariantId: EntityId;
  quantity: number;
}

export interface UpdateCartItemPayload {
  quantity: number;
}

export interface CheckoutCartPayload {
  shippingAddress: string;
  paymentMethod: PaymentMethod;
}

export interface CheckoutCartResponse {
  cart: CartRecord;
  order: OrderRecord;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: string[];
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

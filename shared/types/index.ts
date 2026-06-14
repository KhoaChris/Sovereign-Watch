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
  | "cancelled"

export type PaymentMethod =
  | "card"
  | "bank_transfer"
  | "cash_on_delivery"
  | "wallet";

export type StripeCheckoutPaymentMethod = Extract<PaymentMethod, "card" | "wallet">;

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
  avatarUrl: string;
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
  authorName: string;
  authorInitials: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PublicReviewRecord {
  id: EntityId;
  productId: EntityId;
  rating: number;
  comment: string;
  authorName: string;
  authorInitials: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface ReviewRecord extends Review {
  productName?: string;
}

export interface ProductRatingDistributionEntry {
  count: number;
  rating: number;
}

export interface ProductReviewSummary {
  averageRating: number;
  distribution: ProductRatingDistributionEntry[];
  reviewCount: number;
}

export interface ProductReviewsResponse {
  items: PublicReviewRecord[];
  summary: ProductReviewSummary;
  viewerReview: PublicReviewRecord | null;
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

export type SupportConversationMode = "human" | "bot";
export type SupportConversationStatus = "open" | "closed" | "archived";
export type SupportChatChannel = "admin" | "ai";
export type SupportSenderRole = "admin" | "bot" | "user";

export interface FirebaseCustomTokenResponse {
  customToken: string;
}

export interface SupportChatProductSuggestion {
  href: string;
  image: string;
  name: string;
  priceLabel: string;
  productId: EntityId;
  type: string;
}

export interface SupportConversation {
  assignedAdminEmail: string;
  assignedAdminId: EntityId | null;
  assignedAdminName: string;
  archivedAt: ISODateString | null;
  archivedByAdminId: EntityId | null;
  archivedByAdminName: string;
  createdAt: ISODateString;
  id: EntityId;
  lastMessage: string;
  lastAdminMessageAt: ISODateString | null;
  lastBotMessageAt: ISODateString | null;
  lastCustomerMessageAt: ISODateString | null;
  lastMessageAt: ISODateString;
  messageCount: number;
  mode: SupportConversationMode;
  moderationFlagCount: number;
  status: SupportConversationStatus;
  unreadForAdmin: number;
  unreadForUser: number;
  updatedAt: ISODateString;
  userEmail: string;
  userId: EntityId;
  userName: string;
}

export interface SupportChatMessage {
  body: string;
  channel: SupportChatChannel;
  conversationId: EntityId;
  createdAt: ISODateString;
  id: EntityId;
  senderId: EntityId;
  senderName: string;
  senderRole: SupportSenderRole;
  moderationFlags: string[];
  suggestions: SupportChatProductSuggestion[];
}

export type AiConciergeResponseSource = "backend_context" | "local_fallback";

export interface AiConciergeMemoryMessage {
  body: string;
  senderRole: SupportSenderRole;
  suggestions: SupportChatProductSuggestion[];
}

export interface AiConciergeRequest {
  memory?: AiConciergeMemoryMessage[];
  message: string;
}

export interface AiConciergeResponse {
  body: string;
  cart?: CartRecord;
  favorites?: FavoriteRecord;
  context: {
    intent: string;
    matchedProducts: number;
    recentOrders: number;
  };
  source: AiConciergeResponseSource;
  suggestions: SupportChatProductSuggestion[];
}

export type AdminAiOperationsIntent =
  | "catalog_draft"
  | "fulfillment"
  | "greeting"
  | "help"
  | "inventory"
  | "product_lookup"
  | "revenue"
  | "revenue_compare"
  | "risk"
  | "strategy"
  | "summary";

export interface AdminAiOperationsMemoryMessage {
  body: string;
  senderRole: Extract<SupportSenderRole, "admin" | "bot">;
  suggestions: SupportChatProductSuggestion[];
}

export interface AdminAiOperationsRequest {
  memory?: AdminAiOperationsMemoryMessage[];
  message: string;
}

export interface AdminAiOperationsMetric {
  label: string;
  tone: "default" | "positive" | "warning" | "critical";
  value: string;
}

export interface AdminAiCatalogDraftVariant {
  color: string;
  discountPrice: number | null;
  price: number;
  size: string;
  sku: string;
  stockQuantity: number;
}

export interface AdminAiCatalogDraft {
  brandId: string;
  categoryId: string;
  description: string;
  imageUrl: string;
  name: string;
  reference: string;
  sourceUrl: string;
  strategyNote: string;
  type: string;
  variants: AdminAiCatalogDraftVariant[];
}

export interface AdminAiOperationsResponse {
  body: string;
  catalogDrafts: AdminAiCatalogDraft[];
  context: {
    activeProducts: number;
    grossRevenue: number;
    intent: AdminAiOperationsIntent;
    lowStockProducts: number;
    orders: number;
    pendingFulfillment: number;
  };
  metrics: AdminAiOperationsMetric[];
  source: "backend_operations";
  suggestions: SupportChatProductSuggestion[];
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

export interface UpsertReviewPayload {
  comment?: string;
  rating: number;
}

export type AdminReviewSortOption = "newest" | "rating-asc" | "rating-desc";

export interface ReviewAdminQuery {
  search?: string;
  sort?: AdminReviewSortOption;
}

export interface SyncAuthSessionPayload {
  fullName?: string;
  avatarUrl?: string | null;
  phoneNumber?: string;
  address?: string;
}

export interface UpdateUserProfilePayload {
  fullName?: string;
  avatarUrl?: string | null;
  phoneNumber?: string;
  address?: string;
  email?: string;
  emailOtpCode?: string;
}

export interface AuthSession {
  user: AuthUserProfile;
}

export interface RequestEmailOtpPayload {
  email: string;
}

export interface VerifyEmailOtpPayload {
  email: string;
  code: string;
}

export interface EmailOtpResponse {
  email: string;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
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

export interface CheckoutDetailsInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  shippingAddress: string;
  deliveryNotes?: string;
  saveToAccount?: boolean;
}

export interface PrepareCheckoutPaymentPayload {
  details: CheckoutDetailsInput;
  paymentMethod: StripeCheckoutPaymentMethod;
}

export interface PrepareCheckoutPaymentResponse {
  amount: number;
  clientSecret: string;
  currency: string;
  paymentIntentId: string;
}

export interface FinalizeCheckoutPayload {
  details: CheckoutDetailsInput;
  paymentIntentId?: string;
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

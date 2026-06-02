# Watch Shop Schema Extraction

## Source

- `embed.txt` points to `DiagramG36`
- Diagram includes:
  - Class diagram for data entities
  - Use case diagram for guest, customer, and admin flows

## Firestore Mapping Notes

- The original diagram uses relational `int` primary keys and foreign keys.
- The implementation will use Firestore document IDs as `string`.
- Relationship fields are preserved as `string` references.
- `DateTime` and `Date` fields are represented as ISO strings at the API boundary.
- `images [JSON]` is normalized to `string[]`.

## Core Type Aliases

```ts
export type EntityId = string;
export type ISODateString = string;
export type ISODateOnlyString = string;
```

## Extracted Interfaces

```ts
export type UserRole = "admin" | "customer";
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
```

## Relationship Summary

- `User` is the base identity model.
- `Admin` extends system privileges from `User`.
- `Customer` extends shopper-specific profile data from `User`.
- `Category` has many `Product`.
- `Brand` manufactures many `Product`.
- `Product` contains many `ProductVariant`.
- `Customer` owns one active `Cart`.
- `Cart` contains many `CartItem`.
- `ProductVariant` can appear in many `CartItem`.
- `Customer` places many `Order`.
- `Order` contains many `OrderItem`.
- `ProductVariant` can appear in many `OrderItem`.
- `Order` requires one `Payment`.
- `Order` requires one `Shipping`.
- `Customer` writes many `Review`.
- `Product` receives many `Review`.
- `Admin` reads `SalesStatistic`.

## Support Chat Collections

Realtime support uses Firestore directly from the authenticated frontend client.

- `supportPresence/admin`: current admin availability heartbeat.
- `supportConversations/{userId}`: one support thread per authenticated user.
- `supportConversations/{userId}/messages/{messageId}`: saved message history for that thread.

Messages can be sent by `user`, `admin`, or `bot`. When the admin heartbeat is fresh, user messages route as a human conversation. When the heartbeat is stale or offline, the frontend writes the user message and appends a basic bot reply, including product suggestions when the message asks about price or product search.

## Use Cases Extracted From The Diagram

### Guest

- Browse categories and brands
- Search and filter watches
- View product details and variants
- Manage cart
- Register account

### Customer

- Log in
- Manage personal information
- Place orders and complete payment
- Track shipping
- Review watches

### Admin

- Log in
- Manage categories and brands
- Manage products and variants
- Manage orders and payments
- Manage customers and reviews
- View revenue statistics

## API Scope For Initial Build

The first implementation pass will focus on the entities requested in the brief:

- `Product`
- `ProductVariant`
- `Order`
- `OrderItem`
- `Payment`
- `Shipping`

The remaining entities will still be typed in the shared model so the codebase can grow without type churn.

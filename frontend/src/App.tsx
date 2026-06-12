import { Suspense, lazy, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { AuthModal } from "./components/AuthModal";
import { storefrontApi } from "./services/api";
import type { ProductRecord } from "./shared";

const HomePage = lazy(async () => {
  const module = await import("./pages/HomePage");
  return { default: module.HomePage };
});

const CollectionPage = lazy(async () => {
  const module = await import("./pages/CollectionPage");
  return { default: module.CollectionPage };
});

const ProductPage = lazy(async () => {
  const module = await import("./pages/ProductPage");
  return { default: module.ProductPage };
});

const OrdersPage = lazy(async () => {
  const module = await import("./pages/OrdersPage");
  return { default: module.OrdersPage };
});

const OperationsPage = lazy(async () => {
  const module = await import("./pages/OperationsPage");
  return { default: module.OperationsPage };
});

const FavoritesPage = lazy(async () => {
  const module = await import("./pages/FavoritesPage");
  return { default: module.FavoritesPage };
});

const CartPage = lazy(async () => {
  const module = await import("./pages/CartPage");
  return { default: module.CartPage };
});

const AccountPage = lazy(async () => {
  const module = await import("./pages/AccountPage");
  return { default: module.AccountPage };
});

const BusinessPage = lazy(async () => {
  const module = await import("./pages/BusinessPage");
  return { default: module.BusinessPage };
});

const ContactPage = lazy(async () => {
  const module = await import("./pages/ContactPage");
  return { default: module.ContactPage };
});

const SupportChatWidget = lazy(async () => {
  const module = await import("./components/SupportChatWidget");
  return { default: module.SupportChatWidget };
});

function RouteFallback() {
  return <div className="route-fallback">Loading watchroom</div>;
}

function App() {
  const [products, setProducts] = useState<ProductRecord[]>([]);

  useEffect(() => {
    let active = true;

    storefrontApi
      .getProducts()
      .then((result) => {
        if (!active) {
          return;
        }

        setProducts(result);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setProducts([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <Header />
      <AuthModal />
      <main className="app-main">
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<HomePage products={products} />} path="/" />
            <Route element={<CollectionPage />} path="/collection" />
            <Route element={<ProductPage />} path="/collection/:productId" />
            <Route element={<OrdersPage />} path="/orders" />
            <Route element={<OperationsPage />} path="/operations" />
            <Route element={<FavoritesPage />} path="/favorites" />
            <Route element={<CartPage />} path="/cart" />
            <Route element={<AccountPage />} path="/account" />
            <Route element={<BusinessPage pageKey="about" />} path="/about" />
            <Route element={<ContactPage />} path="/contact" />
            <Route
              element={<BusinessPage pageKey="client-services" />}
              path="/client-services"
            />
            <Route
              element={<BusinessPage pageKey="shipping-returns" />}
              path="/shipping-returns"
            />
            <Route
              element={<BusinessPage pageKey="privacy" />}
              path="/privacy"
            />
            <Route element={<BusinessPage pageKey="terms" />} path="/terms" />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <Suspense fallback={null}>
        <SupportChatWidget />
      </Suspense>
    </div>
  );
}

export default App;

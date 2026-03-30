/** @type {import('next').NextConfig} */
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // 👈 CLAVE
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  turbopack: {}, // 👈 ESTO SOLUCIONA EL ERROR
};

export default withPWA(nextConfig);
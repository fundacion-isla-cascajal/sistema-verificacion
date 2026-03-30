import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: 'Fundación Isla Cascajal - Sistema de Verificación',
  description: 'Sistema oficial de verificación de documentos',

  manifest: '/manifest.json',

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Isla Cascajal',
  },

  icons: {
  icon: [
    { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }, // 👈 CLAVE
    { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }, // 👈 CLAVE
  ],
  apple: '/apple-icon.png',
},
}
export const viewport = {
  themeColor: '#1e3a5f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // 👈 mejora en móviles
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}

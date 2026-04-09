import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'

// Configuramos la fuente web "Inter" desde Google Fonts para toda la app
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Metadatos globales: Sirven para establecer el nombre de la página y SEO
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

// Función Layout Raíz de Next.js: Es la estructura inamovible que contiene las vistas
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <div className="flex-1">
          {children}
        </div>
        <footer className="py-8 bg-card border-t mt-auto">
          <div className="container mx-auto px-4 text-center space-y-2">
            <p className="text-sm font-medium text-foreground/70 uppercase tracking-widest">
              Aplicación desarrollada por Zayra Ramos
            </p>
            <p className="text-xs text-muted-foreground">
              para Fundación Isla Cascajal
            </p>
          </div>
        </footer>
        <Toaster richColors position="top-center" />
        <Analytics />
      </body>
    </html>
  )
}

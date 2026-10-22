// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document.js';

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                {/* Clean vector SVG favicon */}
                <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234f46e5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='16 18 22 12 16 6'></polyline><polyline points='8 6 2 12 8 18'></polyline></svg>" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link 
                    href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" 
                    rel="stylesheet" 
                />
            </Head>
            <body className="bg-slate-50 text-slate-900 antialiased selection:bg-indigo-600 selection:text-white min-h-screen font-sans">
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
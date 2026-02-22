import Navigation from "./components/Navigation";

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <Navigation />
                <main>
                { children }
                </main>
                <footer>Copyright by Soreal Property</footer>
            </body>
        </html>
    )
}

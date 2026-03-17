import LayoutShell from '@/components/LayoutShell';
import './globals.css';

export const metadata = {
    title: 'WorkerManage — Smart Worker Allocation System',
    description: 'Intelligent worker-to-machine allocation based on efficiency scores',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <LayoutShell>
                    {children}
                </LayoutShell>
                <div id="toast-container" className="toast-container"></div>
            </body>
        </html>
    );
}



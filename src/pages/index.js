import axios from 'axios';
import { useEffect, useState } from 'react';
import { styled } from '../../stitches.config';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import MetricCard from '../components/MetricCard';

// --- MOCK DATA ---
// Using mock data until the API connection is resolved.
const useMockData = false;

const mockStats = {
    unique_users: 123,
    total_generations: 456,
    total_exports: 789,
};

const mockDailyData = [
    { date: '2026-01-18', unique_users: 10, total_generations: 30, total_exports: 5 },
    { date: '2026-01-19', unique_users: 15, total_generations: 45, total_exports: 12 },
    { date: '2026-01-20', unique_users: 12, total_generations: 38, total_exports: 8 },
    { date: '2026-01-21', unique_users: 20, total_generations: 60, total_exports: 15 },
    { date: '2026-01-22', unique_users: 18, total_generations: 55, total_exports: 14 },
    { date: '2026-01-23', unique_users: 25, total_generations: 70, total_exports: 20 },
    { date: '2026-01-24', unique_users: 22, total_generations: 65, total_exports: 18 },
];
// --- END MOCK DATA ---

const API_URL = 'https://www.himudigonda.me/api/telemetry/summary';
const DAILY_API_URL = 'https://www.himudigonda.me/api/telemetry/daily-summary';

const Dashboard = () => {
    const [stats, setStats] = useState(null); // For the summary cards
    const [dailyData, setDailyData] = useState(null); // For the time-series chart
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllData = async () => {
        setLoading(true);
        setError(null);
        
        if (useMockData) {
            setStats(mockStats);
            setDailyData(mockDailyData);
            setLoading(false);
            return;
        }

        try {
            // This is the live API call that is currently failing.
            const summaryPromise = axios.get(API_URL);
            const dailyPromise = axios.get(DAILY_API_URL);

            const [summaryResponse, dailyResponse] = await Promise.all([summaryPromise, dailyPromise]);

            setStats(summaryResponse.data);
            setDailyData(dailyResponse.data);

        } catch (e) {
            console.error("Failed to fetch data:", e);
            setError('Could not fetch dashboard data. Using mock data as a fallback.');
            // Fallback to mock data on error
            setStats(mockStats);
            setDailyData(mockDailyData);
        } finally {
            setLoading(false);
        }
    };

    // --- Initial Fetch ---
    useEffect(() => {
        fetchAllData();
    }, []);
    
    // --- UX/UI Logic ---
    const handleRefresh = () => {
        fetchAllData();
    };

    if (loading) return <LoadingContainer>Initializing Dashboard...</LoadingContainer>;
    if (error && !useMockData) return <ErrorContainer>Error: {error}</ErrorContainer>;
    if (!stats) return <ErrorContainer>Data loading failed.</ErrorContainer>;


    // Prepare data for charts
    const chartData = dailyData ? dailyData.map(d => ({
        date: d.date,
        Users: d.unique_users,
        Generations: d.total_generations,
        Exports: d.total_exports,
    })) : [];

    // --- RENDER ---
    return (
        <DashboardLayout>
            <Header>
                <Title>SuperSay Metrics Dashboard</Title>
                <HeaderActions>
                    <SakshiLink href="/sakshi">Sakshi Beta →</SakshiLink>
                    <RefreshButton onClick={handleRefresh} disabled={loading}>Refresh</RefreshButton>
                </HeaderActions>
            </Header>
            
            <StatGrid>
                <MetricCard title="Total Unique Users" value={stats.unique_users || 0} accentColor="$cyan" />
                <MetricCard title="Total Generations" value={stats.total_generations || 0} accentColor="$purple" />
                <MetricCard title="Total Exports" value={stats.total_exports || 0} accentColor="$orange" />
            </StatGrid>
            
            <ChartSection>
                <ChartTitle>Daily Usage Trend</ChartTitle>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <XAxis dataKey="date" stroke="$secondary" fontSize={12} />
                        <YAxis stroke="$secondary" />
                        <Tooltip contentStyle={{ backgroundColor: '$navBackground', border: '1px solid $hover' }} />
                        <Legend wrapperStyle={{ paddingTop: '15px' }} />
                        <Line type="monotone" dataKey="Users" stroke="#80ffea" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Generations" stroke="#9580ff" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="Exports" stroke="#ffca80" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartSection>

            <RawDataSection>
                <h2>Raw Daily Log</h2>
                <p>Data directly aggregated from usage reports.</p>
                <pre>{JSON.stringify(dailyData, null, 2)}</pre>
            </RawDataSection>

        </DashboardLayout>
    );
};

// Define Styled Components (using your existing Stitches config/tokens)
const DashboardLayout = styled('main', { padding: '40px', minHeight: '100vh', background: '$cardBackground', color: '$primary' });
const Header = styled('header', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' });
const HeaderActions = styled('div', { display: 'flex', gap: '12px', alignItems: 'center' });
const SakshiLink = styled('a', { color: '$cyan', fontSize: '14px', textDecoration: 'none', padding: '10px 16px', border: '1px solid $cyan', borderRadius: '$borderRadius', '&:hover': { background: 'rgba(128, 255, 234, 0.1)' } });
const Title = styled('h1', { color: '$primary', fontSize: '36px' });
const RefreshButton = styled('button', { 
    background: '$navBackground',
    color: '$cyan',
    border: '1px solid $cyan',
    padding: '10px 20px',
    borderRadius: '$borderRadius',
    cursor: 'pointer',
    '&:hover': {
        background: 'rgba(128, 255, 234, 0.1)',
    },
    '&:disabled': {
        opacity: 0.5,
        cursor: 'not-allowed',
    }
});
const StatGrid = styled('div', { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', marginBottom: '50px' });
const ChartSection = styled('div', { padding: '20px', backgroundColor: '$navBackground', borderRadius: '$borderRadius', border: '1px solid $hover', marginBottom: '20px' });
const ChartTitle = styled('h2', { fontSize: '20px', color: '$primary', marginBottom: '15px' });
const RawDataSection = styled('div', { padding: '20px', backgroundColor: '$navBackground', borderRadius: '$borderRadius', border: '1px solid $hover' });
const LoadingContainer = styled('div', { color: '$secondary', textAlign: 'center', marginTop: '100px', fontSize: '24px' });
const ErrorContainer = styled('div', { color: '$red', textAlign: 'center', marginTop: '100px', fontSize: '24px' });

export default Dashboard;
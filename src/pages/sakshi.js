import axios from 'axios';
import { useEffect, useState } from 'react';
import { styled } from '../../stitches.config';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import MetricCard from '../components/MetricCard';
import UserTable from '../components/UserTable';

const SUMMARY_URL = 'https://www.himudigonda.me/api/sakshi-beta/summary';
const DAILY_URL = 'https://www.himudigonda.me/api/sakshi-beta/daily-summary';

function daysSince(isoDate) {
  if (!isoDate) return null;
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.max(1, Math.floor(diff / 86400000));
}

const SakshiDashboard = () => {
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, dailyRes] = await Promise.all([
        axios.get(SUMMARY_URL),
        axios.get(DAILY_URL),
      ]);
      setSummary(summaryRes.data);
      setDailyData(dailyRes.data);
    } catch (e) {
      console.error('Failed to fetch Sakshi data:', e);
      setError('Could not load data. Is himudigonda.me running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) return <LoadingContainer>Loading Sakshi Beta data…</LoadingContainer>;
  if (error) return <ErrorContainer>{error}</ErrorContainer>;
  if (!summary) return <ErrorContainer>No data returned.</ErrorContainer>;

  // Oldest user's onboarding date for "X users in Y days" headline
  const oldestOnboarding =
    summary.users.length > 0
      ? summary.users[summary.users.length - 1]?.onboardedAt
      : null;
  const daysActive = daysSince(oldestOnboarding);

  // Daily signups chart data
  const signupsChartData = dailyData.map((d) => ({ date: d.date.substring(5), count: d.count }));

  // Referral breakdown chart data (sorted by count)
  const referralChartData = Object.entries(summary.referralBreakdown || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <DashboardLayout>
      {/* Header */}
      <Header>
        <div>
          <Title>Sakshi Beta</Title>
          {daysActive && summary.totalUsers > 0 && (
            <Subtitle>
              {summary.totalUsers} user{summary.totalUsers !== 1 ? 's' : ''} in {daysActive} day{daysActive !== 1 ? 's' : ''}
            </Subtitle>
          )}
        </div>
        <HeaderActions>
          <NavLink href="/">← SuperSay</NavLink>
          <RefreshButton onClick={fetchAll} disabled={loading}>Refresh</RefreshButton>
        </HeaderActions>
      </Header>

      {/* Metric Cards */}
      <StatGrid>
        <MetricCard title="Total Beta Users" value={summary.totalUsers} accentColor="$cyan" />
        <MetricCard title="Last 7 Days" value={summary.usersLast7Days} accentColor="$purple" />
        <MetricCard title="Today" value={summary.usersToday} accentColor="$orange" />
        <MetricCard title="Trials Expired" value={summary.totalExpired} accentColor="#ff6b6b" />
      </StatGrid>

      {/* Daily Signups Chart */}
      <ChartSection>
        <ChartTitle>Daily Signups (last 30 days)</ChartTitle>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={signupsChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <XAxis dataKey="date" stroke="#8892b0" fontSize={11} tick={{ fill: '#8892b0' }} />
            <YAxis stroke="#8892b0" allowDecimals={false} tick={{ fill: '#8892b0' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#112240', border: '1px solid #233554', color: '#ccd6f6' }}
            />
            <Line type="monotone" dataKey="count" name="Users" stroke="#80ffea" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* Referral Source Breakdown */}
      {referralChartData.length > 0 && (
        <ChartSection>
          <ChartTitle>Acquisition Channels</ChartTitle>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={referralChartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 60, bottom: 5 }}
            >
              <XAxis type="number" stroke="#8892b0" allowDecimals={false} tick={{ fill: '#8892b0', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" stroke="#8892b0" tick={{ fill: '#ccd6f6', fontSize: 12 }} width={60} />
              <Tooltip
                contentStyle={{ backgroundColor: '#112240', border: '1px solid #233554', color: '#ccd6f6' }}
              />
              <Bar dataKey="count" name="Users" fill="#9580ff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      )}

      {/* User Table */}
      <SectionHeader>
        <ChartTitle>Beta Users ({summary.totalUsers})</ChartTitle>
      </SectionHeader>
      <UserTable users={summary.users} />

      {/* Raw JSON (debug) */}
      <RawDataSection>
        <ChartTitle>Raw Data</ChartTitle>
        <pre>{JSON.stringify(summary, null, 2)}</pre>
      </RawDataSection>
    </DashboardLayout>
  );
};

const DashboardLayout = styled('main', {
  padding: '40px',
  minHeight: '100vh',
  background: '$cardBackground',
  color: '$primary',
});
const Header = styled('header', {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '40px',
});
const HeaderActions = styled('div', {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
});
const Title = styled('h1', { color: '$primary', fontSize: '36px', margin: 0 });
const Subtitle = styled('p', { color: '$secondary', fontSize: '16px', margin: '6px 0 0 0' });
const NavLink = styled('a', {
  color: '$cyan',
  fontSize: '14px',
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});
const RefreshButton = styled('button', {
  background: '$navBackground',
  color: '$cyan',
  border: '1px solid $cyan',
  padding: '10px 20px',
  borderRadius: '$borderRadius',
  cursor: 'pointer',
  '&:hover': { background: 'rgba(128, 255, 234, 0.1)' },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
});
const StatGrid = styled('div', {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '24px',
  marginBottom: '40px',
});
const ChartSection = styled('div', {
  padding: '20px',
  backgroundColor: '$navBackground',
  borderRadius: '$borderRadius',
  border: '1px solid $hover',
  marginBottom: '24px',
});
const SectionHeader = styled('div', { marginBottom: '12px' });
const ChartTitle = styled('h2', { fontSize: '18px', color: '$primary', marginBottom: '16px', margin: '0 0 16px 0' });
const RawDataSection = styled('div', {
  padding: '20px',
  backgroundColor: '$navBackground',
  borderRadius: '$borderRadius',
  border: '1px solid $hover',
  marginTop: '32px',
  '& pre': { color: '$secondary', fontSize: '12px', overflowX: 'auto' },
});
const LoadingContainer = styled('div', {
  color: '$secondary',
  textAlign: 'center',
  marginTop: '100px',
  fontSize: '24px',
});
const ErrorContainer = styled('div', {
  color: 'red',
  textAlign: 'center',
  marginTop: '100px',
  fontSize: '18px',
});

export default SakshiDashboard;

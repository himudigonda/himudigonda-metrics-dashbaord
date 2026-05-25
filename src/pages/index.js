import { useEffect, useState } from 'react';
import { styled } from '../../stitches.config';
import {
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    Cell,
    CartesianGrid,
} from 'recharts';
import MetricCard from '../components/MetricCard';
import { fetchAllSupersay } from '../lib/supersay-api';

// --- MOCK DATA (fallback only — used when the API is unreachable) ---
const mockOverview = {
    users_total: 0,
    users_signed: 0,
    dau: 0,
    wau: 0,
    generations_total: 0,
    audio_seconds_total: 0,
    sample_size_warning: true,
};
const mockDaily = { days: 90, series: [], sample_size_warning: true };
const mockVoices = { voices: [], total: 0, sample_size_warning: true };
const mockRetention = { weeks: 12, cohorts: [], sample_size_warning: true };
const mockAudiobook = { uploads: 0, pages_total: 0, audio_seconds_total: 0, gemini_pages_cleaned: 0, completed: 0, completion_rate: 0, sample_size_warning: true };

const VOICE_COLORS = ['#80ffea', '#9580ff', '#ffca80', '#ff80bf', '#80ffaa', '#80b3ff', '#ff8080', '#bfff80'];

function fmtHours(seconds) {
    const h = seconds / 3600;
    if (h >= 100) return `${Math.round(h)} hr`;
    if (h >= 10) return `${h.toFixed(1)} hr`;
    if (h >= 1) return `${h.toFixed(2)} hr`;
    return `${Math.round(seconds / 60)} min`;
}

const Dashboard = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const all = await fetchAllSupersay();
            setData(all);
        } catch (e) {
            console.error('Failed to fetch SuperSay metrics:', e);
            setError('Could not fetch live data. Showing placeholders.');
            setData({
                overview: mockOverview,
                daily: mockDaily,
                voices: mockVoices,
                retention: mockRetention,
                audiobook: mockAudiobook,
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading && !data) return <LoadingContainer>Initializing Dashboard…</LoadingContainer>;
    if (!data) return <ErrorContainer>Data loading failed.</ErrorContainer>;

    const { overview, daily, voices, retention, audiobook } = data;

    const trendData = (daily.series || []).map((d) => ({
        date: d.date,
        Users: d.users,
        Generations: d.generations,
        AudioHours: Math.round((d.audio_seconds / 3600) * 10) / 10,
    }));

    const voiceData = (voices.voices || []).slice(0, 8).map((v) => ({
        voice: v.voice,
        generations: v.generations,
    }));

    return (
        <DashboardLayout>
            <Header>
                <div>
                    <Title>SuperSay Metrics</Title>
                    <Subtitle>Counts only — never your text. <a href="https://github.com/himudigonda/SuperSay/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">PRIVACY.md →</a></Subtitle>
                </div>
                <HeaderActions>
                    <SakshiLink href="/sakshi">Sakshi Beta →</SakshiLink>
                    <RefreshButton onClick={fetchData} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</RefreshButton>
                </HeaderActions>
            </Header>

            {error && <ErrorBanner>{error}</ErrorBanner>}
            {overview.sample_size_warning && (
                <PreviewBanner>Preview — sample size is small. Numbers will stabilize as v1.1 adoption grows.</PreviewBanner>
            )}

            {/* F1 — Overview cards */}
            <StatGrid>
                <MetricCard title="Total Users" value={overview.users_total} accentColor="$cyan" />
                <MetricCard title="Signed In" value={overview.users_signed} accentColor="$purple" />
                <MetricCard title="DAU" value={overview.dau} accentColor="$orange" />
                <MetricCard title="WAU" value={overview.wau} accentColor="$cyan" />
                <MetricCard title="TTS Calls (total)" value={overview.generations_total} accentColor="$purple" />
                <MetricCard title="Audio Generated" value={fmtHours(overview.audio_seconds_total)} accentColor="$orange" />
            </StatGrid>

            {/* F2 — Daily trend */}
            <ChartSection>
                <ChartTitle>Daily Trend (last 90 days)</ChartTitle>
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={trendData} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.55)" fontSize={11} />
                        <YAxis yAxisId="left" stroke="rgba(255,255,255,0.55)" fontSize={11} />
                        <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.55)" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '15px' }} />
                        <Line yAxisId="left" type="monotone" dataKey="Users" stroke="#80ffea" strokeWidth={2} dot={false} />
                        <Line yAxisId="left" type="monotone" dataKey="Generations" stroke="#9580ff" strokeWidth={2} dot={false} />
                        <Line yAxisId="right" type="monotone" dataKey="AudioHours" stroke="#ffca80" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartSection>

            <Row>
                {/* F3 — Voice distribution */}
                <ChartSection css={{ flex: 1 }}>
                    <ChartTitle>Voice Distribution</ChartTitle>
                    {voiceData.length === 0 ? (
                        <EmptyMsg>No voice data yet — first generation event will populate this.</EmptyMsg>
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={voiceData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="voice" stroke="rgba(255,255,255,0.55)" fontSize={11} />
                                <YAxis stroke="rgba(255,255,255,0.55)" fontSize={11} />
                                <Tooltip contentStyle={{ backgroundColor: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)' }} />
                                <Bar dataKey="generations">
                                    {voiceData.map((entry, idx) => (
                                        <Cell key={`v-${idx}`} fill={VOICE_COLORS[idx % VOICE_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartSection>

                {/* F5 — Audiobook funnel */}
                <ChartSection css={{ flex: 1 }}>
                    <ChartTitle>Audiobook Funnel</ChartTitle>
                    <FunnelGrid>
                        <FunnelStat>
                            <FunnelLabel>Uploads</FunnelLabel>
                            <FunnelValue>{audiobook.uploads}</FunnelValue>
                        </FunnelStat>
                        <FunnelStat>
                            <FunnelLabel>Pages processed</FunnelLabel>
                            <FunnelValue>{audiobook.pages_total}</FunnelValue>
                        </FunnelStat>
                        <FunnelStat>
                            <FunnelLabel>Listening time</FunnelLabel>
                            <FunnelValue>{fmtHours(audiobook.audio_seconds_total)}</FunnelValue>
                        </FunnelStat>
                        <FunnelStat>
                            <FunnelLabel>Completed plays</FunnelLabel>
                            <FunnelValue>{audiobook.completed}</FunnelValue>
                        </FunnelStat>
                        <FunnelStat css={{ gridColumn: 'span 2' }}>
                            <FunnelLabel>Upload → Play conversion</FunnelLabel>
                            <FunnelValue>{audiobook.completion_rate}%</FunnelValue>
                        </FunnelStat>
                    </FunnelGrid>
                </ChartSection>
            </Row>

            {/* F4 — Retention cohort heatmap */}
            <ChartSection>
                <ChartTitle>Retention Cohorts (D1 / D7 / D30)</ChartTitle>
                {(retention.cohorts || []).length === 0 ? (
                    <EmptyMsg>No cohort data yet — needs at least one full day of installs.</EmptyMsg>
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Signup date</Th>
                                <Th>Cohort size</Th>
                                <Th>D1</Th>
                                <Th>D7</Th>
                                <Th>D30</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {retention.cohorts.map((c) => (
                                <tr key={c.signup_date}>
                                    <Td>{c.signup_date}</Td>
                                    <Td>{c.cohort_size}</Td>
                                    <RetentionCell pct={c.d1}>{c.d1}%</RetentionCell>
                                    <RetentionCell pct={c.d7}>{c.d7}%</RetentionCell>
                                    <RetentionCell pct={c.d30}>{c.d30}%</RetentionCell>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </ChartSection>
        </DashboardLayout>
    );
};

// --- styled components ---
const DashboardLayout = styled('main', { padding: '40px', minHeight: '100vh', background: '$cardBackground', color: '$primary' });
const Header = styled('header', { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' });
const HeaderActions = styled('div', { display: 'flex', gap: '12px', alignItems: 'center' });
const SakshiLink = styled('a', { color: '$cyan', fontSize: '14px', textDecoration: 'none', padding: '10px 16px', border: '1px solid $cyan', borderRadius: '$borderRadius', '&:hover': { background: 'rgba(128, 255, 234, 0.1)' } });
const Title = styled('h1', { color: '$primary', fontSize: '36px', margin: 0 });
const Subtitle = styled('p', { color: '$secondary', margin: '6px 0 0 0', fontSize: '13px', a: { color: '$cyan' } });
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
const StatGrid = styled('div', { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' });
const Row = styled('div', { display: 'flex', gap: '20px', marginBottom: '20px', '@media (max-width: 900px)': { flexDirection: 'column' } });
const ChartSection = styled('div', { padding: '20px', backgroundColor: '$navBackground', borderRadius: '$borderRadius', border: '1px solid $hover', marginBottom: '20px' });
const ChartTitle = styled('h2', { fontSize: '18px', color: '$primary', marginBottom: '15px' });
const PreviewBanner = styled('div', { padding: '10px 16px', borderRadius: '$borderRadius', background: 'rgba(255, 202, 128, 0.08)', border: '1px solid rgba(255, 202, 128, 0.25)', color: '#ffca80', fontSize: '13px', marginBottom: '20px' });
const ErrorBanner = styled('div', { padding: '10px 16px', borderRadius: '$borderRadius', background: 'rgba(255, 128, 128, 0.08)', border: '1px solid rgba(255, 128, 128, 0.25)', color: '#ff8080', fontSize: '13px', marginBottom: '20px' });
const EmptyMsg = styled('p', { color: '$secondary', fontSize: '13px', textAlign: 'center', padding: '32px 0' });
const LoadingContainer = styled('div', { color: '$secondary', textAlign: 'center', marginTop: '100px', fontSize: '24px' });
const ErrorContainer = styled('div', { color: '$red', textAlign: 'center', marginTop: '100px', fontSize: '24px' });
const FunnelGrid = styled('div', { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' });
const FunnelStat = styled('div', { padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '$borderRadius', border: '1px solid rgba(255, 255, 255, 0.05)' });
const FunnelLabel = styled('div', { color: '$secondary', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' });
const FunnelValue = styled('div', { color: '$primary', fontSize: '22px', fontWeight: 'bold' });
const Table = styled('table', { width: '100%', borderCollapse: 'collapse', fontSize: '13px' });
const Th = styled('th', { textAlign: 'left', padding: '10px', color: '$secondary', fontWeight: 'normal', borderBottom: '1px solid $hover' });
const Td = styled('td', { padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' });
const RetentionCellBase = styled('td', {
    padding: '10px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontWeight: 'bold',
});

// Heatmap color based on retention percentage: higher = greener.
const RetentionCell = ({ pct, children }) => {
    let bg = 'rgba(255,255,255,0.02)';
    if (pct >= 50) bg = 'rgba(128, 255, 170, 0.20)';
    else if (pct >= 25) bg = 'rgba(128, 255, 170, 0.12)';
    else if (pct >= 10) bg = 'rgba(255, 202, 128, 0.10)';
    else if (pct > 0) bg = 'rgba(255, 128, 128, 0.08)';
    return <RetentionCellBase css={{ background: bg }}>{children}</RetentionCellBase>;
};

export default Dashboard;

import { useCallback, useEffect, useState } from "react";
import { styled } from "../../stitches.config";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import MetricCard from "../components/MetricCard";
import { fetchAllVoqora } from "../lib/voqora-api";

const SECTION_NAMES = [
	"engines",
	"sources",
	"dictation",
	"ai",
	"adoption",
	"creation",
	"relay",
	"versions",
	"daily_usage",
];

const PLACEHOLDER = {
	overview: {
		voqora_reported_installations: 0,
		opted_in_email_contacts: 0,
		download_clicks_total: 0,
		voqora_active_installations_today: 0,
		voqora_active_installations_7d: 0,
		voqora_generations_total: 0,
		voqora_audio_seconds_total: 0,
		sample_size_warning: true,
	},
	daily: { days: 90, series: [] },
	voices: { voices: [], total: 0 },
	retention: { weeks: 12, cohorts: [] },
	audiobook: {
		uploads: 0,
		pages_total: 0,
		audio_seconds_total: 0,
		gemini_pages_cleaned: 0,
		plays: 0,
		play_per_upload_rate: 0,
	},
	degraded: SECTION_NAMES,
};

const PALETTE = [
	"#80ffea",
	"#9580ff",
	"#ffca80",
	"#ff80bf",
	"#80ffaa",
	"#80b3ff",
	"#ff8080",
	"#bfff80",
	"#c3a6ff",
	"#ffa6c9",
];
const OUTCOME_COLORS = {
	pasted: "#80ffaa",
	copied: "#80ffea",
	copied_needs_accessibility: "#ffca80",
	copied_app_changed: "#9580ff",
	cancelled: "#8892b0",
	empty: "#ff8080",
};
const FEATURE_LABELS = {
	generation: "Speech generation",
	export: "Export",
	audiobook_upload: "Audiobook upload",
	audiobook_play: "Audiobook play",
	gemini_clean: "Gemini clean",
	dictation: "Dictation",
	audiobook_generated: "Audiobook generated",
	audiobook_finished: "Audiobook finished",
	podcast_script: "Podcast script",
	podcast_render: "Podcast render",
	ai_request: "AI request",
	relay_request: "Relay request",
	library_import: "Library import",
};

const AXIS = "rgba(255,255,255,0.55)";
const GRID = "rgba(255,255,255,0.06)";
const TOOLTIP_STYLE = {
	backgroundColor: "#0f0f12",
	border: "1px solid rgba(255,255,255,0.1)",
	borderRadius: 8,
};

const fmtInt = (value) =>
	Math.round(Number(value) || 0).toLocaleString("en-US");
const fmtPct = (value) =>
	value === null || value === undefined ? "—" : `${Number(value).toFixed(1)}%`;
const fmtMs = (value) =>
	value === null || value === undefined ? "—" : `${fmtInt(value)} ms`;

function fmtHours(seconds) {
	const h = seconds / 3600;
	if (h >= 100) return `${Math.round(h)} hr`;
	if (h >= 10) return `${h.toFixed(1)} hr`;
	if (h >= 1) return `${h.toFixed(2)} hr`;
	return `${Math.round(seconds / 60)} min`;
}

const sum = (rows, key) =>
	rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);

function mergeTrend(daily, dictation) {
	const byDate = new Map();
	for (const row of daily.series || []) {
		byDate.set(row.date, {
			date: row.date,
			generations: row.voqora_generations,
			audiobookUploads: row.voqora_audiobook_uploads,
			dictation: 0,
		});
	}
	for (const row of dictation?.series || []) {
		const existing = byDate.get(row.date) || {
			date: row.date,
			generations: 0,
			audiobookUploads: 0,
			dictation: 0,
		};
		existing.dictation = row.sessions;
		byDate.set(row.date, existing);
	}
	return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function Panel({
	title,
	name,
	section,
	degraded,
	isEmpty,
	emptyText,
	children,
	css,
}) {
	let body;
	if (section === null || section === undefined) {
		body = (
			<DegradedMsg>
				{degraded.includes(name)
					? "Unavailable: the database is missing this read model. Apply the latest Supabase migration to enable it."
					: "Not reported by the metrics service yet. Deploy the matching website release."}
			</DegradedMsg>
		);
	} else if (isEmpty) {
		body = <EmptyMsg>{emptyText}</EmptyMsg>;
	} else {
		body = children;
	}
	return (
		<ChartSection css={css}>
			<ChartTitle>{title}</ChartTitle>
			{body}
		</ChartSection>
	);
}

const Dashboard = () => {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const fetchData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			setData(await fetchAllVoqora());
		} catch (e) {
			console.error("Failed to fetch Voqora metrics:", e);
			const message = e instanceof Error ? e.message : "";
			if (message.includes("older schema")) {
				setError(
					"The metrics service is on an older schema. No live numbers are being shown until the website and database are upgraded together.",
				);
			} else if (message.includes("VOQORA_METRICS_TOKEN")) {
				setError(message);
			} else {
				setError("Could not fetch live data. Showing placeholders.");
			}
			setData({
				...PLACEHOLDER,
				...Object.fromEntries(SECTION_NAMES.map((name) => [name, null])),
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	if (loading && !data)
		return <LoadingContainer>Initializing Dashboard…</LoadingContainer>;
	if (!data) return <ErrorContainer>Data loading failed.</ErrorContainer>;

	const {
		overview,
		daily,
		voices,
		retention,
		audiobook,
		engines,
		sources,
		dictation,
		ai,
		adoption,
		creation,
		relay,
		versions,
		daily_usage: dailyUsage,
	} = data;
	const degraded = data.degraded || [];
	const showDegradedBanner = degraded.length > 0 && !error;

	const dictationWords = dictation ? sum(dictation.series, "words") : null;
	const aiRequests = ai ? ai.total_requests : null;
	const trend = mergeTrend(daily, dictation);

	const engineRows = engines?.engines || [];
	const latencyBars = engineRows
		.filter(
			(row) =>
				row.first_audio_ms_p50 !== null || row.first_audio_ms_p90 !== null,
		)
		.map((row) => ({
			engine: row.engine,
			p50: row.first_audio_ms_p50,
			p90: row.first_audio_ms_p90,
		}));

	const sourceRows = sources?.sources || [];
	const dictationSeries = dictation?.series || [];
	const aiRows = ai?.tools || [];
	const featureBars = (adoption?.features || []).map((row) => ({
		feature: FEATURE_LABELS[row.feature] || row.feature,
		actors30d: row.actors_30d,
		actors7d: row.actors_7d,
		share: row.share_of_active_30d,
	}));
	const versionRows = versions?.versions || [];
	const relayRows = relay?.clients || [];
	const usageSeries = dailyUsage?.series || [];
	const voiceRows = (voices.voices || []).slice(0, 8);
	const creationIsEmpty =
		!creation ||
		creation.audiobooks_generated +
			creation.podcast_scripts +
			creation.podcast_renders ===
			0;

	return (
		<DashboardLayout>
			<Header>
				<div>
					<Title>Voqora Metrics</Title>
					<Subtitle>
						Reported installations are anonymous app installs that successfully
						deliver analytics. Activity events are separate, email contacts are
						opt-in, and release-page clicks are not installs.{" "}
						<a
							href="https://github.com/himudigonda/Voqora/blob/main/PRIVACY.md"
							target="_blank"
							rel="noreferrer"
						>
							PRIVACY.md →
						</a>
					</Subtitle>
				</div>
				<HeaderActions>
					<RefreshButton onClick={fetchData} disabled={loading}>
						{loading ? "Refreshing…" : "Refresh"}
					</RefreshButton>
				</HeaderActions>
			</Header>

			{error && <ErrorBanner>{error}</ErrorBanner>}
			{showDegradedBanner && (
				<PreviewBanner>
					Degraded sections: {degraded.join(", ")}. The database is missing read
					models for these; apply the latest migration.
				</PreviewBanner>
			)}
			{overview.sample_size_warning && (
				<PreviewBanner>
					Preview — sample size is small. Numbers will stabilize as adoption
					grows.
				</PreviewBanner>
			)}

			<StatGrid>
				<MetricCard
					title="Reported installs"
					value={fmtInt(overview.voqora_reported_installations)}
					accentColor="$cyan"
				/>
				<MetricCard
					title="Active today / 7d"
					value={`${fmtInt(overview.voqora_active_installations_today)} / ${fmtInt(overview.voqora_active_installations_7d)}`}
					accentColor="$purple"
				/>
				<MetricCard
					title="Generations"
					value={fmtInt(overview.voqora_generations_total)}
					accentColor="$orange"
				/>
				<MetricCard
					title="Audio generated"
					value={fmtHours(overview.voqora_audio_seconds_total)}
					accentColor="$cyan"
				/>
				<MetricCard
					title="Dictation words"
					value={dictationWords === null ? "—" : fmtInt(dictationWords)}
					accentColor="$purple"
				/>
				<MetricCard
					title="AI requests"
					value={aiRequests === null ? "—" : fmtInt(aiRequests)}
					accentColor="$orange"
				/>
			</StatGrid>

			<ChartSection>
				<ChartTitle>
					Daily activity: generations, dictation sessions, audiobook uploads
				</ChartTitle>
				{trend.length === 0 ? (
					<EmptyMsg>No daily activity yet.</EmptyMsg>
				) : (
					<ResponsiveContainer width="100%" height={340}>
						<AreaChart
							data={trend}
							margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
							<XAxis dataKey="date" stroke={AXIS} fontSize={11} />
							<YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Legend wrapperStyle={{ paddingTop: "15px" }} />
							<Area
								type="monotone"
								dataKey="generations"
								name="Generations"
								stroke="#80ffea"
								fill="#80ffea"
								fillOpacity={0.18}
								strokeWidth={2}
							/>
							<Area
								type="monotone"
								dataKey="dictation"
								name="Dictation sessions"
								stroke="#ffca80"
								fill="#ffca80"
								fillOpacity={0.18}
								strokeWidth={2}
							/>
							<Area
								type="monotone"
								dataKey="audiobookUploads"
								name="Audiobook uploads"
								stroke="#ff80bf"
								fill="#ff80bf"
								fillOpacity={0.18}
								strokeWidth={2}
							/>
						</AreaChart>
					</ResponsiveContainer>
				)}
				{dictation === null && (
					<DegradedMsg>
						Dictation series unavailable; the chart shows generations and
						uploads only.
					</DegradedMsg>
				)}
			</ChartSection>

			<Row>
				<Panel
					title="Engines"
					name="engines"
					section={engines}
					degraded={degraded}
					isEmpty={engineRows.length === 0}
					emptyText="No engine data yet. Needs generation events that carry an engine."
					css={{ flex: 1 }}
				>
					<TableWrap>
						<Table>
							<thead>
								<tr>
									<Th>Engine</Th>
									<Th>Generations</Th>
									<Th>Audio</Th>
									<Th>p50</Th>
									<Th>p90</Th>
									<Th>Failures</Th>
									<Th>Failure rate</Th>
								</tr>
							</thead>
							<tbody>
								{engineRows.map((row) => (
									<tr key={row.engine}>
										<Td>{row.engine}</Td>
										<Td>{fmtInt(row.generations)}</Td>
										<Td>{fmtHours(row.audio_seconds)}</Td>
										<Td>{fmtMs(row.first_audio_ms_p50)}</Td>
										<Td>{fmtMs(row.first_audio_ms_p90)}</Td>
										<Td>{fmtInt(row.failures)}</Td>
										<Td>{fmtPct(row.failure_rate)}</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</TableWrap>
				</Panel>

				<Panel
					title="First audio latency (p50 / p90)"
					name="engines"
					section={engines}
					degraded={degraded}
					isEmpty={latencyBars.length === 0}
					emptyText="No first-audio timings yet."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer width="100%" height={260}>
						<BarChart
							data={latencyBars}
							margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
							<XAxis dataKey="engine" stroke={AXIS} fontSize={11} />
							<YAxis stroke={AXIS} fontSize={11} unit=" ms" />
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Legend />
							<Bar
								dataKey="p50"
								name="p50"
								fill="#80ffea"
								radius={[4, 4, 0, 0]}
							/>
							<Bar
								dataKey="p90"
								name="p90"
								fill="#9580ff"
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</Panel>
			</Row>

			<Row>
				<Panel
					title="Speech source"
					name="sources"
					section={sources}
					degraded={degraded}
					isEmpty={sourceRows.length === 0}
					emptyText="No source data yet. Needs generation events that carry a source."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer width="100%" height={280}>
						<PieChart>
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Legend />
							<Pie
								data={sourceRows}
								dataKey="generations"
								nameKey="source"
								innerRadius={60}
								outerRadius={100}
								paddingAngle={2}
								stroke="none"
							>
								{sourceRows.map((row, idx) => (
									<Cell key={row.source} fill={PALETTE[idx % PALETTE.length]} />
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</Panel>

				<Panel
					title="Dictation outcomes"
					name="dictation"
					section={dictation}
					degraded={degraded}
					isEmpty={dictationSeries.length === 0}
					emptyText="No dictation sessions yet."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer width="100%" height={280}>
						<BarChart
							data={dictationSeries}
							margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
							<XAxis dataKey="date" stroke={AXIS} fontSize={11} />
							<YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Legend />
							{Object.entries(OUTCOME_COLORS).map(([outcome, color]) => (
								<Bar
									key={outcome}
									dataKey={outcome}
									stackId="outcomes"
									fill={color}
								/>
							))}
						</BarChart>
					</ResponsiveContainer>
				</Panel>
			</Row>

			<Row>
				<Panel
					title="Dictation words per day"
					name="dictation"
					section={dictation}
					degraded={degraded}
					isEmpty={dictationSeries.length === 0}
					emptyText="No dictation words yet."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer width="100%" height={260}>
						<LineChart
							data={dictationSeries}
							margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
							<XAxis dataKey="date" stroke={AXIS} fontSize={11} />
							<YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Line
								type="monotone"
								dataKey="words"
								name="Words"
								stroke="#ffca80"
								strokeWidth={2}
								dot={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				</Panel>

				<Panel
					title="Per-install daily usage"
					name="daily_usage"
					section={dailyUsage}
					degraded={degraded}
					isEmpty={usageSeries.length === 0}
					emptyText="No daily usage summaries yet. Clients send one after each completed local day."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer width="100%" height={260}>
						<LineChart
							data={usageSeries}
							margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
							<XAxis dataKey="date" stroke={AXIS} fontSize={11} />
							<YAxis stroke={AXIS} fontSize={11} />
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Legend />
							<Line
								type="monotone"
								dataKey="avg_listen_minutes"
								name="Avg listen min"
								stroke="#80ffea"
								strokeWidth={2}
								dot={false}
							/>
							<Line
								type="monotone"
								dataKey="avg_active_minutes"
								name="Avg active min"
								stroke="#9580ff"
								strokeWidth={2}
								dot={false}
							/>
							<Line
								type="monotone"
								dataKey="avg_dictation_words"
								name="Avg dictation words"
								stroke="#ffca80"
								strokeWidth={2}
								dot={false}
							/>
						</LineChart>
					</ResponsiveContainer>
				</Panel>
			</Row>

			<Panel
				title="AI tools by provider"
				name="ai"
				section={ai}
				degraded={degraded}
				isEmpty={aiRows.length === 0}
				emptyText="No AI requests yet."
			>
				<TableWrap>
					<Table>
						<thead>
							<tr>
								<Th>Tool</Th>
								<Th>Provider</Th>
								<Th>Requests</Th>
								<Th>OK rate</Th>
								<Th>p50 latency</Th>
							</tr>
						</thead>
						<tbody>
							{aiRows.map((row) => (
								<tr key={`${row.tool}:${row.provider}`}>
									<Td>{row.tool}</Td>
									<Td>{row.provider}</Td>
									<Td>{fmtInt(row.requests)}</Td>
									<Td>{fmtPct(row.ok_rate)}</Td>
									<Td>{fmtMs(row.p50_latency_ms)}</Td>
								</tr>
							))}
						</tbody>
					</Table>
				</TableWrap>
			</Panel>

			<Row>
				<Panel
					title="Feature adoption (distinct installs)"
					name="adoption"
					section={adoption}
					degraded={degraded}
					isEmpty={featureBars.length === 0}
					emptyText="No feature usage yet."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer
						width="100%"
						height={Math.max(240, featureBars.length * 44)}
					>
						<BarChart
							data={featureBars}
							layout="vertical"
							margin={{ top: 5, right: 24, left: 20, bottom: 5 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke={GRID}
								horizontal={false}
							/>
							<XAxis
								type="number"
								stroke={AXIS}
								fontSize={11}
								allowDecimals={false}
							/>
							<YAxis
								type="category"
								dataKey="feature"
								stroke={AXIS}
								fontSize={11}
								width={130}
							/>
							<Tooltip
								contentStyle={TOOLTIP_STYLE}
								formatter={(value, name, item) =>
									name === "Installs 30d"
										? [
												`${value} (${fmtPct(item.payload.share)} of active)`,
												name,
											]
										: [value, name]
								}
							/>
							<Legend />
							<Bar
								dataKey="actors30d"
								name="Installs 30d"
								fill="#80ffea"
								radius={[0, 4, 4, 0]}
							/>
							<Bar
								dataKey="actors7d"
								name="Installs 7d"
								fill="#9580ff"
								radius={[0, 4, 4, 0]}
							/>
						</BarChart>
					</ResponsiveContainer>
				</Panel>

				<Panel
					title="Version adoption (active installs, 7d)"
					name="versions"
					section={versions}
					degraded={degraded}
					isEmpty={versionRows.length === 0}
					emptyText="No version data yet."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer width="100%" height={260}>
						<BarChart
							data={versionRows}
							margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
							<XAxis dataKey="app_version" stroke={AXIS} fontSize={11} />
							<YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Bar
								dataKey="distinct_actors"
								name="Installs"
								radius={[4, 4, 0, 0]}
							>
								{versionRows.map((row, idx) => (
									<Cell
										key={row.app_version}
										fill={PALETTE[idx % PALETTE.length]}
									/>
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</Panel>
			</Row>

			<Row>
				<Panel
					title="Creation"
					name="creation"
					section={creation}
					degraded={degraded}
					isEmpty={creationIsEmpty}
					emptyText="No audiobooks or podcasts created yet."
					css={{ flex: 1 }}
				>
					<FunnelGrid>
						<FunnelStat>
							<FunnelLabel>Audiobooks generated</FunnelLabel>
							<FunnelValue>
								{fmtInt(creation?.audiobooks_generated)}
							</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Audiobooks finished</FunnelLabel>
							<FunnelValue>{fmtInt(creation?.audiobooks_finished)}</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Chapters</FunnelLabel>
							<FunnelValue>{fmtInt(creation?.chapters)}</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Audio hours</FunnelLabel>
							<FunnelValue>
								{(creation?.audio_hours ?? 0).toFixed(1)}
							</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Podcast scripts</FunnelLabel>
							<FunnelValue>{fmtInt(creation?.podcast_scripts)}</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Podcast renders</FunnelLabel>
							<FunnelValue>{fmtInt(creation?.podcast_renders)}</FunnelValue>
						</FunnelStat>
					</FunnelGrid>
				</Panel>

				<Panel
					title="MCP / relay clients"
					name="relay"
					section={relay}
					degraded={degraded}
					isEmpty={relayRows.length === 0}
					emptyText="No relay requests yet."
					css={{ flex: 1 }}
				>
					<ResponsiveContainer
						width="100%"
						height={Math.max(220, relayRows.length * 40)}
					>
						<BarChart
							data={relayRows}
							layout="vertical"
							margin={{ top: 5, right: 24, left: 10, bottom: 5 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke={GRID}
								horizontal={false}
							/>
							<XAxis
								type="number"
								stroke={AXIS}
								fontSize={11}
								allowDecimals={false}
							/>
							<YAxis
								type="category"
								dataKey="client"
								stroke={AXIS}
								fontSize={11}
								width={90}
							/>
							<Tooltip contentStyle={TOOLTIP_STYLE} />
							<Bar dataKey="requests" name="Requests" radius={[0, 4, 4, 0]}>
								{relayRows.map((row, idx) => (
									<Cell key={row.client} fill={PALETTE[idx % PALETTE.length]} />
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</Panel>
			</Row>

			<Row>
				<ChartSection css={{ flex: 1 }}>
					<ChartTitle>Voice distribution</ChartTitle>
					{voiceRows.length === 0 ? (
						<EmptyMsg>
							No voice data yet. The first generation event will populate this.
						</EmptyMsg>
					) : (
						<ResponsiveContainer width="100%" height={260}>
							<BarChart
								data={voiceRows}
								margin={{ top: 5, right: 16, left: 0, bottom: 5 }}
							>
								<CartesianGrid strokeDasharray="3 3" stroke={GRID} />
								<XAxis dataKey="voice" stroke={AXIS} fontSize={11} />
								<YAxis stroke={AXIS} fontSize={11} allowDecimals={false} />
								<Tooltip contentStyle={TOOLTIP_STYLE} />
								<Bar dataKey="generations" radius={[4, 4, 0, 0]}>
									{voiceRows.map((row, idx) => (
										<Cell
											key={row.voice}
											fill={PALETTE[idx % PALETTE.length]}
										/>
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					)}
				</ChartSection>

				<ChartSection css={{ flex: 1 }}>
					<ChartTitle>Audiobook library</ChartTitle>
					<FunnelGrid>
						<FunnelStat>
							<FunnelLabel>Uploads</FunnelLabel>
							<FunnelValue>{fmtInt(audiobook.uploads)}</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Pages processed</FunnelLabel>
							<FunnelValue>{fmtInt(audiobook.pages_total)}</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Listening time</FunnelLabel>
							<FunnelValue>
								{fmtHours(audiobook.audio_seconds_total)}
							</FunnelValue>
						</FunnelStat>
						<FunnelStat>
							<FunnelLabel>Completed plays</FunnelLabel>
							<FunnelValue>{fmtInt(audiobook.plays)}</FunnelValue>
						</FunnelStat>
						<FunnelStat css={{ gridColumn: "span 2" }}>
							<FunnelLabel>Upload → Play conversion</FunnelLabel>
							<FunnelValue>{audiobook.play_per_upload_rate}%</FunnelValue>
						</FunnelStat>
					</FunnelGrid>
				</ChartSection>
			</Row>

			<ChartSection>
				<ChartTitle>Retention cohorts (D1 / D7 / D30)</ChartTitle>
				{(retention.cohorts || []).length === 0 ? (
					<EmptyMsg>
						No cohort data yet. Needs at least one full day of installs.
					</EmptyMsg>
				) : (
					<TableWrap>
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
					</TableWrap>
				)}
			</ChartSection>
		</DashboardLayout>
	);
};

const DashboardLayout = styled("main", {
	padding: "40px",
	minHeight: "100vh",
	background: "$cardBackground",
	color: "$primary",
	"@media (max-width: 600px)": { padding: "20px 14px" },
});
const Header = styled("header", {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "16px",
	marginBottom: "24px",
	"@media (max-width: 700px)": { flexDirection: "column" },
});
const HeaderActions = styled("div", {
	display: "flex",
	gap: "12px",
	alignItems: "center",
});
const Title = styled("h1", { color: "$primary", fontSize: "36px", margin: 0 });
const Subtitle = styled("p", {
	color: "$secondary",
	margin: "6px 0 0 0",
	fontSize: "13px",
	a: { color: "$cyan" },
});
const RefreshButton = styled("button", {
	background: "$navBackground",
	color: "$cyan",
	border: "1px solid $cyan",
	padding: "10px 20px",
	borderRadius: "$borderRadius",
	cursor: "pointer",
	"&:hover": { background: "rgba(128, 255, 234, 0.1)" },
	"&:disabled": { opacity: 0.5, cursor: "not-allowed" },
});
const StatGrid = styled("div", {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
	gap: "20px",
	marginBottom: "32px",
});
const Row = styled("div", {
	display: "flex",
	gap: "20px",
	"@media (max-width: 900px)": { flexDirection: "column", gap: 0 },
});
const ChartSection = styled("div", {
	padding: "20px",
	backgroundColor: "$navBackground",
	borderRadius: "$borderRadius",
	border: "1px solid $hover",
	marginBottom: "20px",
	minWidth: 0,
});
const ChartTitle = styled("h2", {
	fontSize: "18px",
	color: "$primary",
	marginTop: 0,
	marginBottom: "15px",
});
const PreviewBanner = styled("div", {
	padding: "10px 16px",
	borderRadius: "$borderRadius",
	background: "rgba(255, 202, 128, 0.08)",
	border: "1px solid rgba(255, 202, 128, 0.25)",
	color: "#ffca80",
	fontSize: "13px",
	marginBottom: "20px",
});
const ErrorBanner = styled("div", {
	padding: "10px 16px",
	borderRadius: "$borderRadius",
	background: "rgba(255, 128, 128, 0.08)",
	border: "1px solid rgba(255, 128, 128, 0.25)",
	color: "#ff8080",
	fontSize: "13px",
	marginBottom: "20px",
});
const EmptyMsg = styled("p", {
	color: "$secondary",
	fontSize: "13px",
	textAlign: "center",
	padding: "32px 0",
	margin: 0,
});
const DegradedMsg = styled("p", {
	color: "#ffca80",
	fontSize: "13px",
	textAlign: "center",
	padding: "24px 12px",
	margin: 0,
});
const LoadingContainer = styled("div", {
	color: "$secondary",
	textAlign: "center",
	marginTop: "100px",
	fontSize: "24px",
});
const ErrorContainer = styled("div", {
	color: "$red",
	textAlign: "center",
	marginTop: "100px",
	fontSize: "24px",
});
const FunnelGrid = styled("div", {
	display: "grid",
	gridTemplateColumns: "repeat(2, 1fr)",
	gap: "14px",
});
const FunnelStat = styled("div", {
	padding: "14px",
	background: "rgba(255, 255, 255, 0.03)",
	borderRadius: "$borderRadius",
	border: "1px solid rgba(255, 255, 255, 0.05)",
});
const FunnelLabel = styled("div", {
	color: "$secondary",
	fontSize: "11px",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
	marginBottom: "6px",
});
const FunnelValue = styled("div", {
	color: "$primary",
	fontSize: "22px",
	fontWeight: "bold",
});
const TableWrap = styled("div", { overflowX: "auto" });
const Table = styled("table", {
	width: "100%",
	borderCollapse: "collapse",
	fontSize: "13px",
});
const Th = styled("th", {
	textAlign: "left",
	padding: "10px",
	color: "$secondary",
	fontWeight: "normal",
	borderBottom: "1px solid $hover",
	whiteSpace: "nowrap",
});
const Td = styled("td", {
	padding: "10px",
	borderBottom: "1px solid rgba(255,255,255,0.05)",
});
const RetentionCellBase = styled("td", {
	padding: "10px",
	borderBottom: "1px solid rgba(255,255,255,0.05)",
	fontWeight: "bold",
});

const RetentionCell = ({ pct, children }) => {
	let bg = "rgba(255,255,255,0.02)";
	if (pct >= 50) bg = "rgba(128, 255, 170, 0.20)";
	else if (pct >= 25) bg = "rgba(128, 255, 170, 0.12)";
	else if (pct >= 10) bg = "rgba(255, 202, 128, 0.10)";
	else if (pct > 0) bg = "rgba(255, 128, 128, 0.08)";
	return (
		<RetentionCellBase css={{ background: bg }}>{children}</RetentionCellBase>
	);
};

export default Dashboard;

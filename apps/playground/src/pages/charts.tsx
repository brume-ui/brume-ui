import {
  BarChart,
  Button,
  Card,
  DonutChart,
  LineChart,
  Sparkline,
  StatCard,
} from '@brume-ui/brume-react';
import { useState } from 'react';
import {
  CATEGORY_REVENUE,
  DAILY_REVENUE,
  MONTHLY_AOV,
  MONTHLY_ORDERS,
  MONTHLY_REFUND,
  MONTHLY_REVENUE,
  ORDER_STATUS,
  QUARTER_CHANNELS,
  REVENUE_SERIES,
  TOP_PRODUCTS,
  TWD,
} from './chart-data';
import { Page, Section } from './page';

const PERCENT = { style: 'percent', maximumFractionDigits: 1 } as const;

/** The four headline numbers, shared with the dashboard page. */
export function KpiRow({ loading = false, bump = 0 }: { loading?: boolean; bump?: number }) {
  return (
    <div className="pg-kpis">
      <StatCard
        label="本月營收"
        value={MONTHLY_REVENUE.at(-1) as number}
        format={TWD}
        delta={{ value: 0.059, period: '上月' }}
        trend={MONTHLY_REVENUE}
        hint="統計至 10/28 12:00"
        loading={loading}
      />
      <StatCard
        label="訂單數"
        value={(MONTHLY_ORDERS.at(-1) as number) + bump}
        delta={{ value: -0.017, period: '上月' }}
        trend={MONTHLY_ORDERS}
        hint="含已取消 64 筆"
        loading={loading}
      />
      <StatCard
        label="平均客單價"
        value={MONTHLY_AOV.at(-1) as number}
        format={TWD}
        delta={{ value: 0.077, period: '上月' }}
        trend={MONTHLY_AOV}
        hint="已完成訂單"
        loading={loading}
      />
      <StatCard
        label="退款率"
        value={MONTHLY_REFUND.at(-1) as number}
        format={PERCENT}
        delta={{ value: -0.095, period: '上月', good: 'down' }}
        trend={MONTHLY_REFUND}
        hint="下降是好消息"
        loading={loading}
      />
    </div>
  );
}

export function RevenueLine(props: { loading?: boolean; height?: number }) {
  return (
    <LineChart
      title="每日營收"
      description="2026 年 10 月，線上與門市"
      data={DAILY_REVENUE}
      xKey="date"
      xType="time"
      series={REVENUE_SERIES}
      valueFormat={TWD}
      height={props.height}
      loading={props.loading}
    />
  );
}

export function StatusDonut(props: { loading?: boolean }) {
  return (
    <DonutChart
      title="訂單狀態"
      description="本月全部訂單"
      data={ORDER_STATUS}
      centerLabel="筆訂單"
      size={180}
      loading={props.loading}
    />
  );
}

export function CategoryBars(props: { loading?: boolean }) {
  return (
    <BarChart
      title="分類營收"
      description="本月，線上與門市"
      data={CATEGORY_REVENUE}
      categoryKey="category"
      series={REVENUE_SERIES}
      valueFormat={TWD}
      loading={props.loading}
    />
  );
}

function StatCardsDemo() {
  const [bump, setBump] = useState(0);
  return (
    <div className="pg-chart-stack">
      <KpiRow bump={bump} />
      <div className="pg-row">
        <Button variant="secondary" onClick={() => setBump((b) => b + 37)}>
          新進 37 筆訂單
        </Button>
      </div>
      <div className="pg-kpis">
        <StatCard label="會員總數" value={48210} hint="沒有比較期間與趨勢" />
        <StatCard
          label="客服待回覆"
          value={12}
          delta={{ value: 0, period: '昨日', good: 'down' }}
        />
        <StatCard label="本月營收" value={0} delta={{ value: 0.1 }} trend={[1, 2]} loading />
      </div>
    </div>
  );
}

export function ChartsPage() {
  const [loading, setLoading] = useState(false);
  return (
    <Page
      name="charts"
      title="圖表"
      lead="不靠圖表套件的 SVG 元件：數字卡、迷你趨勢、長條、折線、甜甜圈。滑過或用 Tab 移到圖上再按方向鍵看數值，點圖例可隱藏數列。"
    >
      <Section title="數字卡 StatCard">
        <StatCardsDemo />
      </Section>

      <Section title="迷你趨勢 Sparkline">
        <Card>
          <div className="pg-sparks">
            <div>
              <p className="pg-label">月營收（12 個月）</p>
              <Sparkline data={MONTHLY_REVENUE} label="月營收" valueFormat={TWD} />
            </div>
            <div>
              <p className="pg-label">訂單數，第 3 色、無面積</p>
              <Sparkline data={MONTHLY_ORDERS} label="訂單數" color={3} area={false} />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="折線 LineChart（時間軸、兩個數列）">
        <Card>
          <RevenueLine />
        </Card>
      </Section>

      <Section title="面積 LineChart area（單一數列）">
        <Card>
          <LineChart
            title="每日總營收"
            data={DAILY_REVENUE}
            xKey="date"
            xType="time"
            xFormat={{ day: 'numeric' }}
            series={[{ key: 'total', label: '總營收' }]}
            valueFormat={TWD}
            area
            height={200}
          />
        </Card>
      </Section>

      <Section title="折線 LineChart（類別軸、單一數列、直線、不含 0）">
        <Card>
          <LineChart
            title="月訂單數"
            data={MONTHLY_ORDERS.map((orders, i) => ({ month: `${i + 1}月`, orders }))}
            xKey="month"
            series={[{ key: 'orders', label: '訂單數' }]}
            curve="linear"
            includeZero={false}
          />
        </Card>
      </Section>

      <Section title="長條 BarChart（分組）">
        <Card>
          <CategoryBars />
        </Card>
      </Section>

      <Section title="長條 BarChart（堆疊、三個數列）">
        <Card>
          <BarChart
            title="各季通路營收"
            data={QUARTER_CHANNELS}
            categoryKey="quarter"
            series={[...REVENUE_SERIES, { key: 'partner', label: '經銷' }]}
            layout="stacked"
            valueFormat={TWD}
          />
        </Card>
      </Section>

      <Section title="長條 BarChart（橫向、長名稱）">
        <Card>
          <BarChart
            title="熱銷商品"
            description="本月售出件數"
            data={TOP_PRODUCTS}
            categoryKey="name"
            series={[{ key: 'units', label: '件數' }]}
            orientation="horizontal"
          />
        </Card>
      </Section>

      <Section title="甜甜圈 DonutChart">
        <Card>
          <StatusDonut />
        </Card>
      </Section>

      <Section title="載入中與沒有資料">
        <div className="pg-row">
          <Button
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          >
            重新載入圖表
          </Button>
        </div>
        <div className="pg-dash pg-dash-even">
          <Card>
            <BarChart
              title="分類營收"
              data={CATEGORY_REVENUE}
              categoryKey="category"
              series={REVENUE_SERIES}
              valueFormat={TWD}
              loading
            />
          </Card>
          <Card>
            <LineChart
              title="每日營收"
              data={[]}
              xKey="date"
              series={REVENUE_SERIES}
              emptyMessage="這段期間還沒有營收"
            />
          </Card>
          <Card>
            <DonutChart title="訂單狀態" data={[]} size={160} />
          </Card>
          <Card>
            <BarChart
              title="分類營收（可重新載入）"
              data={CATEGORY_REVENUE}
              categoryKey="category"
              series={REVENUE_SERIES}
              valueFormat={TWD}
              loading={loading}
              height={200}
            />
          </Card>
        </div>
      </Section>
    </Page>
  );
}

export function DashboardPage() {
  const [loading, setLoading] = useState(false);
  return (
    <Page
      name="dashboard"
      title="儀表板範例"
      lead="4 張數字卡、營收折線、訂單狀態甜甜圈、分類長條。"
    >
      <div className="pg-row pg-dash-bar">
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1200);
          }}
        >
          重新整理
        </Button>
      </div>
      <div className="pg-chart-stack">
        <KpiRow loading={loading} />
        <div className="pg-dash">
          <Card>
            <RevenueLine loading={loading} height={318} />
          </Card>
          <Card>
            <StatusDonut loading={loading} />
          </Card>
        </div>
        <Card>
          <CategoryBars loading={loading} />
        </Card>
      </div>
    </Page>
  );
}

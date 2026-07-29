import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { WeekSnapshot } from "../types";
import { useIsDark } from "../useColorScheme";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// Deliberately a neutral gray (not a categorical hue) paired with one alarm
// red -- validated for CVD separation (dE 24.9) and contrast on both chart
// surfaces. See dataviz skill: the chroma-floor check is scoped to
// categorical palettes and doesn't apply to an intentional neutral/status pair.
const DEMAND_COLOR = "#898781";
const FACTORY_COLOR = "#d03b3b";

interface Props {
  weeks: WeekSnapshot[];
  maxY?: number;
  heightPx?: number;
}

export function DemandChart({ weeks, maxY, heightPx }: Props) {
  const isDark = useIsDark();
  const gridline = isDark ? "#2c2c2a" : "#e1e0d9";
  const tickColor = "#898781";
  const legendColor = isDark ? "#c3c2b7" : "#525142";
  const tooltipBg = isDark ? "#222221" : "#ffffff";
  const tooltipTitle = isDark ? "#ffffff" : "#0b0b0b";
  const tooltipBody = isDark ? "#c3c2b7" : "#52514e";

  const data = useMemo(
    () => ({
      labels: weeks.map((w) => w.week),
      datasets: [
        {
          label: "Customer demand",
          data: weeks.map((w) => w.customer_demand),
          borderColor: DEMAND_COLOR,
          backgroundColor: DEMAND_COLOR,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: "Factory orders",
          data: weeks.map((w) => w.tiers[3]?.order ?? null),
          borderColor: FACTORY_COLOR,
          backgroundColor: FACTORY_COLOR,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
        },
      ],
    }),
    [weeks]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 as const },
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          position: "top" as const,
          align: "end" as const,
          labels: { color: legendColor, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipTitle,
          bodyColor: tooltipBody,
          borderColor: gridline,
          borderWidth: 1,
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { color: gridline },
          ticks: { color: tickColor, maxTicksLimit: 10 },
          title: { display: true, text: "Week", color: tickColor },
        },
        y: {
          grid: { color: gridline },
          ticks: { color: tickColor },
          title: { display: true, text: "Units ordered", color: tickColor },
          beginAtZero: true,
          ...(maxY !== undefined ? { max: maxY } : {}),
        },
      },
    }),
    [gridline, tickColor, legendColor, tooltipBg, tooltipTitle, tooltipBody, maxY]
  );

  return (
    <div className="demand-chart" style={heightPx ? { height: heightPx } : undefined}>
      <Line data={data} options={options} />
    </div>
  );
}

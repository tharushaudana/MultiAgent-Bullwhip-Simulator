import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { WeekSnapshot } from "../types";
import { useIsDark } from "../useColorScheme";

export interface ChartMark {
  week: number;
  color: string;
  label?: string;
  dash?: number[];
}

interface WeekMarkerPluginOptions {
  marks: { index: number; color: string; label?: string; dash?: number[] }[];
}

// Small inline plugin (no chartjs-plugin-annotation dependency) that draws
// one or more labeled dashed vertical lines -- used for the demand-step week
// and the current scrub/live position.
const weekMarkerPlugin: Plugin<"line", unknown> = {
  id: "weekMarkerPlugin",
  afterDatasetsDraw(chart) {
    const opts = (chart.options.plugins as Record<string, unknown> | undefined)?.weekMarkerPlugin as
      | WeekMarkerPluginOptions
      | undefined;
    const marks = opts?.marks ?? [];
    if (marks.length === 0) return;

    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    if (!xScale || !chartArea) return;

    ctx.save();
    for (const mark of marks) {
      if (mark.index < 0) continue;
      const x = xScale.getPixelForValue(mark.index);
      if (Number.isNaN(x)) continue;

      ctx.beginPath();
      ctx.strokeStyle = mark.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(mark.dash ?? [4, 4]);
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();

      if (mark.label) {
        ctx.setLineDash([]);
        ctx.fillStyle = mark.color;
        ctx.font = "10px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(mark.label, x + 4, chartArea.top + 10);
      }
    }
    ctx.restore();
  },
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, weekMarkerPlugin);

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
  marks?: ChartMark[];
}

export function DemandChart({ weeks, maxY, heightPx, marks }: Props) {
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

  const resolvedMarks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    return marks.map((m) => ({
      index: weeks.findIndex((w) => w.week === m.week),
      color: m.color,
      label: m.label,
      dash: m.dash,
    }));
  }, [marks, weeks]);

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
        weekMarkerPlugin: { marks: resolvedMarks },
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
    [gridline, tickColor, legendColor, tooltipBg, tooltipTitle, tooltipBody, maxY, resolvedMarks]
  );

  return (
    <div className="demand-chart" style={heightPx ? { height: heightPx } : undefined}>
      <Line data={data} options={options} />
    </div>
  );
}

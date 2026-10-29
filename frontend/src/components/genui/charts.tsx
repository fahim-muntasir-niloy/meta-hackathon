"use client";

// Chart renderers for the stock chart components, drawn with the charts of
// @openuidev/react-ui's main bundle.
//
// genui-lib is a separate bundle with its own private ThemeContext, so its
// charts never see the app's ThemeProvider: no palette, no dark mode. These
// take the same props and map them the same way, but render components that
// read the app's theme. They also animate in.

import type { ComponentRenderer } from "@openuidev/react-lang";
import type { ComponentType } from "react";
import {
  AreaChartCondensed,
  BarChartCondensed,
  HorizontalBarChart,
  LineChartCondensed,
  PieChart,
  RadarChart,
  RadialChart,
  SingleStackedBar,
} from "@openuidev/react-ui";

type Node = { type?: string; props?: Record<string, unknown> };
type Props = Record<string, unknown>;
// The chart components differ in their exact props; each gets the ones it takes.
type Chart = ComponentType<Record<string, unknown>>;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const elements = (v: unknown) => asArray(v).filter((x): x is Node => !!x && typeof x === "object" && (x as Node).type === "element");

/** labels + Series(category, values) nodes, or labels + 2D rows, to chart rows (genui-lib's buildChartData). */
function chartRows(labels: unknown, series: unknown) {
  const names = asArray(labels) as string[];
  const rows = asArray(series);
  if (rows.length && Array.isArray(rows[0])) {
    return (rows as unknown[][]).map((cells) => {
      const point: Record<string, string | number> = { category: String(cells[0] ?? "") };
      names.slice(1).forEach((name, i) => {
        const v = cells[i + 1];
        point[name] = typeof v === "number" ? v : Number(v) || 0;
      });
      return point;
    });
  }
  const nodes = elements(series);
  return names.map((label, i) => {
    const point: Record<string, string | number> = { category: label };
    for (const s of nodes) {
      const cat = s.props?.category;
      const vals = s.props?.values;
      if (typeof cat === "string" && Array.isArray(vals) && i < vals.length) point[cat] = vals[i];
    }
    return point;
  });
}

/** labels + values, or Slice(category, value) nodes, to one-series rows. */
function sliceRows(labels: unknown, values: unknown) {
  const names = asArray(labels);
  const nums = asArray(values);
  if (names.length && nums.length) {
    return names.map((category, i) => ({ category: String(category), value: typeof nums[i] === "number" ? (nums[i] as number) : 0 }));
  }
  return elements(labels).map((s) => ({ category: String(s.props?.category ?? ""), value: Number(s.props?.value) || 0 }));
}

const cartesian = (Chart: Chart, opts: { height?: boolean; variant?: boolean } = { height: true, variant: true }) =>
  function CartesianChart({ props }: Parameters<ComponentRenderer<Props>>[0]) {
    if (props.labels == null || props.series == null) return null;
    const data = chartRows(props.labels, props.series);
    if (!data.length) return null;
    return (
      <Chart
        data={data}
        categoryKey="category"
        variant={opts.variant ? props.variant : undefined}
        xAxisLabel={props.xLabel}
        yAxisLabel={props.yLabel}
        height={opts.height ? props.height : undefined}
        isAnimationActive
      />
    );
  };

const sliced = (Chart: Chart, extra: (props: Props) => Props = () => ({})) =>
  function SlicedChart({ props }: Parameters<ComponentRenderer<Props>>[0]) {
    const data = sliceRows(props.labels, props.values);
    if (!data.length) return null;
    return <Chart data={data} categoryKey="category" dataKey="value" isAnimationActive {...extra(props)} />;
  };

/** By component name, as the stock library registers them. */
export const chartRenderers: Record<string, ComponentRenderer<Props>> = {
  BarChart: cartesian(BarChartCondensed as unknown as Chart),
  LineChart: cartesian(LineChartCondensed as unknown as Chart),
  AreaChart: cartesian(AreaChartCondensed as unknown as Chart),
  HorizontalBarChart: cartesian(HorizontalBarChart as unknown as Chart, { variant: true }),
  RadarChart: cartesian(RadarChart as unknown as Chart, {}),
  PieChart: sliced(PieChart as unknown as Chart, (p) => ({ variant: p.variant ?? "pie", appearance: p.appearance ?? "circular" })),
  RadialChart: sliced(RadialChart as unknown as Chart),
  SingleStackedBarChart: sliced(SingleStackedBar as unknown as Chart),
};

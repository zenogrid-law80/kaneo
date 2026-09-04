import { useId } from "react";
import { useTranslation } from "react-i18next";

type Point = {
  month: string;
  createdTasks: number;
  completedTasks: number;
};

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 36, left: 32 };

function MonthlyTaskChart({ points }: { points: Point[] }) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maximum = Math.max(
    1,
    ...points.flatMap((point) => [point.createdTasks, point.completedTasks]),
  );
  const x = (index: number) =>
    PADDING.left + (index / Math.max(points.length - 1, 1)) * plotWidth;
  const y = (value: number) =>
    PADDING.top + plotHeight - (value / maximum) * plotHeight;
  const path = (key: "createdTasks" | "completedTasks") =>
    points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`,
      )
      .join(" ");
  const monthFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    month: "short",
    year: "2-digit",
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          {t("statistics:monthly.created")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500" />
          {t("statistics:monthly.completed")}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="min-w-[640px]"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{t("statistics:monthly.chartLabel")}</title>
          {[0, 0.5, 1].map((ratio) => {
            const value = Math.round(maximum * (1 - ratio));
            const lineY = PADDING.top + plotHeight * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={lineY}
                  y2={lineY}
                  className="stroke-border"
                  strokeDasharray="3 3"
                />
                <text
                  x={PADDING.left - 8}
                  y={lineY + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {value}
                </text>
              </g>
            );
          })}
          <path
            d={path("createdTasks")}
            fill="none"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d={path("completedTasks")}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {points.map((point, index) => (
            <g key={point.month}>
              <circle
                cx={x(index)}
                cy={y(point.createdTasks)}
                r="3"
                className="fill-primary"
              >
                <title>{`${point.month}: ${t("statistics:monthly.created")} ${point.createdTasks}`}</title>
              </circle>
              <circle
                cx={x(index)}
                cy={y(point.completedTasks)}
                r="3"
                className="fill-emerald-500"
              >
                <title>{`${point.month}: ${t("statistics:monthly.completed")} ${point.completedTasks}`}</title>
              </circle>
              <text
                x={x(index)}
                y={HEIGHT - 12}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {monthFormatter.format(new Date(`${point.month}-01T00:00:00Z`))}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default MonthlyTaskChart;

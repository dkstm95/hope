# Hope quantitative chart standard

Read this standard when a visual property represents a quantity. A chart must
make the source claim easier to see without changing it.

## Establish the data contract

Before choosing a chart, identify values, units, definitions, time window,
denominator, ordering, missing values, uncertainty, and source. If one of these
changes the claim and is unknown, show that limitation or use a table or prose.
Never manufacture precision to complete a series.

## Choose an honest encoding

| Reading job | Preferred encoding |
| --- | --- |
| Compare discrete magnitudes | Bar chart; horizontal bars for long labels |
| See change over ordered time | Line chart; keep sampled segments straight and gaps visible |
| Compare two states for several items | Dumbbell or slope chart; use a table when exact values dominate |
| See correlation between two quantities | Scatter plot; use bubble area only for a real third quantity |
| See one distribution or compare distributions | Exact dot plot or beeswarm for a small set; histogram with disclosed bins for shape; aligned small multiples or restrained ridgelines for comparable groups |
| See part-to-whole area | Treemap only when the total is meaningful and every area is proportional |
| See quantities split or merge | Proportional flow or Sankey only when totals balance and one scale is used |
| Compare normalized multi-criteria profiles | Radar only with a disclosed common normalization; otherwise use bars or a table |
| See rank movement | Rank or bump chart; state that magnitude is not encoded |
| Read a few exact values | Table, not a chart |

Use position or length before area, angle, or decoration when they answer the
same question. Do not use a chart type merely because it looks distinctive.

When bubble area encodes a non-negative quantity, use one shared constant so
every area is proportional to its value. Equivalently, derive each radius from
the square root of its value under one shared scale; never make radius directly
proportional to value. Represent zero without giving it a positive visual area,
using a clearly non-quantitative zero label or glyph when it must remain
visible. Use another encoding or separate, disclosed treatment for negative
values.

## Keep scales and transformations truthful

- Use one stated unit and comparable scale for comparable marks.
- Start length, area, and other magnitude-by-size encodings at zero.
- A line chart may use a non-zero domain only when absolute magnitude is not the
  claim; show and explain the domain.
- Do not smooth unsampled data or imply values inside a gap.
- Never coerce missing values to zero or silently impute them.
- Preserve chronological, cyclic, ranked, or narrative order when it is
  meaningful; otherwise state the chosen sort.
- Do not move marks away from their values to make labels fit. Move labels,
  change the layout, or annotate outside the plot.
- Avoid dual scales. Use small multiples or separate charts unless a shared
  comparison is explicit and the two scales cannot mislead.

Label axes, units, bounds, and important values. Include only legend entries
that appear. Disclose aggregation, normalization, smoothing, exclusions,
rounding, and an `Other` category when any could change the interpretation.
Visual rounding must not alter the underlying values or totals.

## Verify quantitative integrity

Check totals and denominators. Part-to-whole areas must sum to the stated total;
split and merge widths must balance; normalized criteria must use the disclosed
method; time intervals must be consistent or visibly irregular.

When source and output are machine-readable, compare every data-to-mark mapping,
or verify the shared data binding and scale plus complete mark coverage. For a
circle, compare area-to-value ratios or the equivalent square-root radius
relationship. When only manual inspection is possible, recompute a
representative coordinate, length, area, or ribbon width; inspect the minimum,
maximum, zero, missing value, and a typical value; and report that work as a
spot-check rather than complete quantitative verification. If the chart cannot
be checked against its source, report it as unverified.

## Make exact meaning accessible

Do not rely on position, shape, or color alone. Provide visible data labels when
they remain readable, or an adjacent accessible table or text equivalent with
the precise values and units. State the conclusion, source, uncertainty, and
important exceptions in text.

This is part of Hope's adaptation of Diagram Design described in the source
section of `diagram-standard.md`. The upstream MIT notice is in
`../LICENSE.diagram-design`.

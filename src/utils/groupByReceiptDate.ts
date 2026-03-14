import { startOfWeek, subWeeks, format, parse } from 'date-fns';

export interface Section<T> {
  title: string;
  data: T[];
}

/**
 * Groups items by receipt/invoice date into: "This week", "Last week", then "Month Year" (newest first).
 * Items without a valid date go in "Other".
 */
export function groupByReceiptDate<T>(
  items: T[],
  getDate: (item: T) => string | undefined
): Section<T>[] {
  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

  const groupMap = new Map<string, T[]>();
  const add = (key: string, item: T) => {
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(item);
  };

  for (const item of items) {
    const dateStr = getDate(item);
    if (!dateStr) {
      add('Other', item);
      continue;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      add('Other', item);
      continue;
    }
    const t = d.getTime();
    if (t >= thisWeekStart.getTime()) add('This week', item);
    else if (t >= lastWeekStart.getTime()) add('Last week', item);
    else add(format(d, 'MMMM yyyy'), item);
  }

  const sortByDateDesc = (a: T, b: T) => {
    const da = new Date(getDate(a) ?? 0).getTime();
    const db = new Date(getDate(b) ?? 0).getTime();
    return db - da;
  };

  const sections: Section<T>[] = [];
  const sectionOrder = ['This week', 'Last week'];
  for (const key of sectionOrder) {
    const data = groupMap.get(key);
    if (data?.length) {
      data.sort(sortByDateDesc);
      sections.push({ title: key, data });
    }
  }

  const monthKeys = [...groupMap.keys()].filter((k) => !sectionOrder.includes(k) && k !== 'Other');
  monthKeys.sort((a, b) => {
    try {
      const dA = parse(a, 'MMMM yyyy', new Date()).getTime();
      const dB = parse(b, 'MMMM yyyy', new Date()).getTime();
      return dB - dA;
    } catch {
      return a.localeCompare(b);
    }
  });
  for (const key of monthKeys) {
    const data = groupMap.get(key)!;
    data.sort(sortByDateDesc);
    sections.push({ title: key, data });
  }

  if (groupMap.has('Other')) {
    const other = groupMap.get('Other')!;
    other.sort(sortByDateDesc);
    sections.push({ title: 'Other', data: other });
  }

  return sections;
}

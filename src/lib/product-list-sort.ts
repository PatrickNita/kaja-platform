export const productListSortOptions = [
  { value: "name-asc", label: "Denumire A–Z" },
  { value: "name-desc", label: "Denumire Z–A" },
  { value: "usage-desc", label: "Cel mai des folosit" },
  { value: "usage-asc", label: "Cel mai rar folosit" },
] as const;
export type ProductListSort = typeof productListSortOptions[number]["value"];
export function catalogueUsageSortAvailable(brand: string | null | undefined, group: string | null | undefined) {
  return (!brand || brand === "all" || brand === "kaja") && (!group || group === "live");
}
export const productSearchKey=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("ro").trim();
export function matchesProductSearch(query:string,...fields:(string|null|undefined)[]) {
  const key=productSearchKey(query);
  return !key || fields.some(field=>productSearchKey(field ?? "").includes(key));
}
export function normalizeProductSort(value: string | null | undefined, usage = false): ProductListSort {
  return productListSortOptions.some(option => option.value === value && (usage || option.value.startsWith("name-"))) ? value as ProductListSort : "name-asc";
}
const names = new Intl.Collator("ro", { sensitivity: "base", numeric: true });
export function sortProductList<T>(rows: readonly T[], sort: ProductListSort, get: (row:T) => {name:string; id:string|number; usage?:number}): T[] {
  return [...rows].sort((left,right) => {
    const a=get(left),b=get(right);
    if (sort.startsWith("usage-")) {
      if (a.usage === undefined && b.usage !== undefined) return 1;
      if (a.usage !== undefined && b.usage === undefined) return -1;
      const difference=(a.usage ?? 0)-(b.usage ?? 0);
      if (difference) return sort === "usage-asc" ? difference : -difference;
    }
    const difference=names.compare(a.name,b.name);
    return (sort === "name-desc" ? -difference : difference) || names.compare(String(a.id),String(b.id));
  });
}

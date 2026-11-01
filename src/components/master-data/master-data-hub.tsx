"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { UnitModal, UnitItem } from "@/components/master-data/unit-modal";
import { CategoryModal, CategoryItem } from "@/components/master-data/category-modal";
import { ProductModal, ProductTemplateItem } from "@/components/master-data/product-modal";
import { toggleUnitStatusAction } from "@/actions/master-data-actions";

interface MasterDataHubProps {
  units: UnitItem[];
  categories: CategoryItem[];
  products: ProductTemplateItem[];
  defaultTab?: "colleges" | "categories" | "products";
}

export function MasterDataHub({
  units,
  categories,
  products,
  defaultTab = "colleges",
}: MasterDataHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as "colleges" | "categories" | "products") || defaultTab;
  const [searchTerm, setSearchTerm] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("ALL");

  const setTab = (tab: "colleges" | "categories" | "products") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    setSearchTerm("");
    setTypeFilter("ALL");
    router.push(`/master-data?${params.toString()}`);
  };

  // ─────────────────────────────────────────────────────────────
  // FILTERING LOGIC
  // ─────────────────────────────────────────────────────────────

  const filteredUnits = React.useMemo(() => {
    return units.filter((u) => {
      const matchSearch =
        u.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.campus && u.campus.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = typeFilter === "ALL" || u.unitType === typeFilter;
      return matchSearch && matchType;
    });
  }, [units, searchTerm, typeFilter]);

  const filteredCategories = React.useMemo(() => {
    return categories.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === "ALL" || c.classification === typeFilter;
      return matchSearch && matchType;
    });
  }, [categories, searchTerm, typeFilter]);

  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.category && p.category.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.category && p.category.code.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchType = typeFilter === "ALL" || p.classification === typeFilter;
      return matchSearch && matchType;
    });
  }, [products, searchTerm, typeFilter]);

  const handleToggleUnit = async (unitId: string) => {
    await toggleUnitStatusAction(unitId, units.find(unit => unit.id === unitId)?.isActive);
    router.refresh();
  };

  return (
    <div className="space-y-6 select-none">
      {/* Tab Navigation Pill Bar */}
      <div className="bg-[#FFFFFF] border border-border rounded p-1.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTab("colleges")}
            className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "colleges"
                ? "bg-[#3B0A0F] text-[#FFFFFF] shadow-sm"
                : "text-[#6E2B32] hover:bg-cream hover:text-[#3B0A0F]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">domain</span>
            <span>Colleges &amp; Units ({units.length})</span>
          </button>

          <button
            onClick={() => setTab("categories")}
            className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "categories"
                ? "bg-[#3B0A0F] text-[#FFFFFF] shadow-sm"
                : "text-[#6E2B32] hover:bg-cream hover:text-[#3B0A0F]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">category</span>
            <span>Product Categories ({categories.length})</span>
          </button>

          <button
            onClick={() => setTab("products")}
            className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === "products"
                ? "bg-[#3B0A0F] text-[#FFFFFF] shadow-sm"
                : "text-[#6E2B32] hover:bg-cream hover:text-[#3B0A0F]"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Standard Product Catalog ({products.length})</span>
          </button>
        </div>

        {/* Create Action Button Contextual to Tab */}
        <div>
          {activeTab === "colleges" && (
            <UnitModal
              allUnits={units.map((u) => ({ id: u.id, code: u.code, name: u.name }))}
              onSuccess={() => router.refresh()}
            />
          )}
          {activeTab === "categories" && (
            <CategoryModal
              onSuccess={() => router.refresh()}
            />
          )}
          {activeTab === "products" && (
            <ProductModal
              categories={categories}
              onSuccess={() => router.refresh()}
            />
          )}
        </div>
      </div>

      {/* Search & Filter Strip */}
      <div className="bg-[#FFFFFF] border border-border p-4 rounded flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#6E2B32] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${
                activeTab === "colleges"
                  ? "by code, college name, or campus..."
                  : activeTab === "categories"
                  ? "by code or category name..."
                  : "by standard product name or category..."
              }`}
              className="w-full pl-9 pr-4 py-2 border border-border rounded bg-cream focus:bg-[#FFFFFF] focus:outline-hidden focus:border-[#A60212] text-xs font-medium"
            />
          </div>
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-[#6E2B32] uppercase mr-1">Filter:</span>
          {activeTab === "colleges" && (
            <>
              {["ALL", "ACADEMIC", "ADMINISTRATIVE", "AUXILIARY", "SATELLITE_CAMPUS"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-colors ${
                    typeFilter === t
                      ? "bg-[#A60212] text-[#FFFFFF]"
                      : "bg-cream text-[#3B0A0F] border border-border hover:bg-sand"
                  }`}
                >
                  {t.replace("_", " ")}
                </button>
              ))}
            </>
          )}

          {(activeTab === "categories" || activeTab === "products") && (
            <>
              {["ALL", "PPE", "SEMI_EXPENDABLE"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase transition-colors ${
                    typeFilter === t
                      ? "bg-[#A60212] text-[#FFFFFF]"
                      : "bg-cream text-[#3B0A0F] border border-border hover:bg-sand"
                  }`}
                >
                  {t === "PPE" ? "PPE (≥ ₱50k)" : t === "SEMI_EXPENDABLE" ? "Semi-Expendable (< ₱50k)" : "All"}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: COLLEGES & OPERATING UNITS TABLE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "colleges" && (
        <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#3B0A0F] text-[#FFFFFF] uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4 font-bold">Code</th>
                  <th className="py-2.5 px-4 font-bold">College / Operating Unit Name</th>
                  <th className="py-2.5 px-3 font-bold">Unit Type</th>
                  <th className="py-2.5 px-3 font-bold">Campus</th>
                  <th className="py-2.5 px-3 font-bold text-center">Governed Assets</th>
                  <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#6E2B32]">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[36px] text-[#A60212]/50 mb-1">
                          domain_disabled
                        </span>
                        <p className="font-bold">No colleges or operating units match your search.</p>
                        <p className="text-[11px] mt-0.5">Click &quot;Add College / Unit&quot; above to register a new unit.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((u) => (
                    <tr key={u.id} className="hover:bg-cream transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#A60212] whitespace-nowrap">
                        {u.code}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#3B0A0F]">
                        {u.name}
                        {u.parentUnitId && (
                          <span className="block text-[10px] font-normal text-[#6E2B32]">
                            Sub-unit under registered parent
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={` inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase  badge-solid ${
                            u.unitType === "ACADEMIC"
                              ? "border badge-solid badge-maroon"
                              : u.unitType === "ADMINISTRATIVE"
                              ? "border badge-solid badge-slate"
                              : u.unitType === "AUXILIARY"
                              ? "border badge-solid badge-amber"
                              : "border badge-solid badge-green"
                          }`}
                        >
                          {u.unitType.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#6E2B32] font-medium whitespace-nowrap">
                        {u.campus ? u.campus.replace("_", " ") : "Main Campus"}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono font-bold px-2.5 py-0.5 rounded border badge-solid badge-slate">
                          <span className="material-symbols-outlined text-[13px] text-[#A60212]">inventory_2</span>
                          {u.assetCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={` inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase  badge-solid ${
                            u.isActive
                              ? " badge-solid badge-green"
                              : " badge-solid badge-crimson"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-[#2E7D32]" : "bg-[#C62828]"}`} />
                          {u.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleUnit(u.id)}
                            title={u.isActive ? "Deactivate Unit" : "Activate Unit"}
                            className="p-1 rounded text-[#6E2B32] hover:bg-cream hover:text-[#3B0A0F]"
                          >
                            <span className="material-symbols-outlined text-[17px]">
                              {u.isActive ? "toggle_on" : "toggle_off"}
                            </span>
                          </button>

                          <UnitModal
                            existingUnit={u}
                            allUnits={units.map((item) => ({ id: item.id, code: item.code, name: item.name }))}
                            triggerButton={
                              <span className="px-2.5 py-1 rounded border hover:bg-sand text-[11px] font-bold inline-flex items-center gap-1 badge-solid badge-slate">
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                <span>Edit</span>
                              </span>
                            }
                            onSuccess={() => router.refresh()}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: PRODUCT CATEGORIES & USEFUL LIFE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "categories" && (
        <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#3B0A0F] text-[#FFFFFF] uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4 font-bold">Category Code</th>
                  <th className="py-2.5 px-4 font-bold">Category Name &amp; Description</th>
                  <th className="py-2.5 px-3 font-bold">COA Classification</th>
                  <th className="py-2.5 px-3 font-bold text-center">Useful Life (Years)</th>
                  <th className="py-2.5 px-3 font-bold text-center">Total Assets</th>
                  <th className="py-2.5 px-3 font-bold text-right">Valuation (PHP)</th>
                  <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#6E2B32]">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[36px] text-[#A60212]/50 mb-1">
                          category
                        </span>
                        <p className="font-bold">No product categories match your search.</p>
                        <p className="text-[11px] mt-0.5">Click &quot;Add Asset Category&quot; to register a new class.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((c) => (
                    <tr key={c.id} className="hover:bg-cream transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#A60212] whitespace-nowrap">
                        {c.code}
                      </td>
                      <td className="py-3 px-4 font-bold text-[#3B0A0F]">
                        {c.name}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={` inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase  badge-solid ${
                            c.classification === "PPE"
                              ? "border badge-solid badge-maroon"
                              : "border badge-solid badge-slate"
                          }`}
                        >
                          {c.classification === "PPE" ? "PPE (≥ ₱50k)" : "Semi-Expendable"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap font-mono font-bold text-[#3B0A0F]">
                        {c.usefulLifeYears} Years
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="font-mono font-bold px-2 py-0.5 rounded border badge-solid badge-slate">
                          {c.assetCount ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#A60212] whitespace-nowrap">
                        {formatCurrency(c.totalValuation || 0)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <CategoryModal
                          existingCategory={c}
                          triggerButton={
                            <span className="px-2.5 py-1 rounded border hover:bg-sand text-[11px] font-bold inline-flex items-center gap-1 badge-solid badge-slate">
                              <span className="material-symbols-outlined text-[14px]">tune</span>
                              <span>Configure</span>
                            </span>
                          }
                          onSuccess={() => router.refresh()}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: STANDARD PRODUCT CATALOG & ITEM TEMPLATES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "products" && (
        <div className="bg-[#FFFFFF] border border-border rounded overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#3B0A0F] text-[#FFFFFF] uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 px-4 font-bold">Standard Product Item</th>
                  <th className="py-2.5 px-4 font-bold">Category</th>
                  <th className="py-2.5 px-3 font-bold">Class</th>
                  <th className="py-2.5 px-4 font-bold">Standard Specifications Template</th>
                  <th className="py-2.5 px-3 font-bold text-right">Benchmark Cost</th>
                  <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[#6E2B32]">
                      <div className="flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[36px] text-[#A60212]/50 mb-1">
                          inventory
                        </span>
                        <p className="font-bold">No standard product templates cataloged yet.</p>
                        <p className="text-[11px] mt-0.5">
                          Standardize equipment names by adding items to the central catalog.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-cream transition-colors">
                      <td className="py-3 px-4 font-bold text-[#3B0A0F]">
                        {p.name}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[#A60212] font-bold block">
                          {p.category?.code}
                        </span>
                        <span className="text-[10px] text-[#6E2B32]">
                          {p.category?.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={` inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase  badge-solid ${
                            p.classification === "PPE"
                              ? "border badge-solid badge-maroon"
                              : "border badge-solid badge-slate"
                          }`}
                        >
                          {p.classification}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6E2B32] max-w-xs truncate">
                        {p.specifications || "Standard institutional procurement specification"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-[#3B0A0F] whitespace-nowrap">
                        {p.benchmarkCost ? formatCurrency(p.benchmarkCost) : "—"}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <ProductModal
                          existingProduct={p}
                          categories={categories}
                          triggerButton={
                            <span className="px-2.5 py-1 rounded border hover:bg-sand text-[11px] font-bold inline-flex items-center gap-1 badge-solid badge-slate">
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              <span>Edit</span>
                            </span>
                          }
                          onSuccess={() => router.refresh()}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

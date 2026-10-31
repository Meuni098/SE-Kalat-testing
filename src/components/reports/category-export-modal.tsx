"use client";
import { ReferenceFormExport } from "./reference-form-export";
interface CategoryExportModalProps {
  categories:{id:string;code:string;name:string;classification:string}[];
  units:{id:string;code:string;name:string}[];
  defaultCategoryId?:string;
}
/** Existing inventory action uses the supplied original files. */
export function CategoryExportModal({defaultCategoryId}:CategoryExportModalProps) {
  return <ReferenceFormExport reportSection="category-history" defaultCategoryId={defaultCategoryId}/>;
}

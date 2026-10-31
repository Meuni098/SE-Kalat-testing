export interface ItemReceiptInput {
  unitId: string;
  operationId: string;
  assetId: string;
  expectedAssetUpdatedAt: string;
  remarks: string;
  receiver: { mode: "EXISTING"; personId: string } | { mode: "NEW"; person: { employeeNo?: string; fullName: string; position: string; email?: string } };
}
export interface ReceiptAssetOption { id: string; propertyNo: string; name: string; updatedAt: string }
export interface ItemReceiptEntry {
  id: string; assetId: string; unitId: string; propertyNo: string; assetName: string;
  unitCode: string; receiverName: string; receiverEmployeeNo: string; receiverPosition: string;
  recordedByName: string; remarks: string; receivedAt: string;
}
export interface ItemReceiptFilters { unitId?: string; assetId?: string; query?: string; page?: number }
export interface ItemReceiptData { items: ItemReceiptEntry[]; total: number; page: number; canManage: boolean; unlinked: boolean }

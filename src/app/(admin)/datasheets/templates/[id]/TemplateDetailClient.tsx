"use client";

import React, { useState } from "react";
import Image from "next/image";
import type { Datasheet, Equipment, Subsheet } from "@/types/datasheetTemplate";
import SubsheetBuilder from "@/components/datasheets/templates/SubsheetBuilder";
import { handleExport } from "@/utils/datasheetExport";

type Template = {
  datasheet: Datasheet;
  equipment: Equipment;
  subsheets: Subsheet[];
};

type ReferenceOptions = {
  areas: { id: number; name: string }[];
  users: { id: number; name: string }[];
  manufacturers: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
  categories: { id: number; name: string }[];
  clients: { id: number; name: string }[];
  projects: { id: number; name: string }[];
};

// cleaner props typing
interface Props {
  templateId: number;
  template: Template;
  referenceOptions: ReferenceOptions;
  isEditMode: boolean;
}

export default function TemplateDetailClient({
  templateId,
  template,
  referenceOptions,
  isEditMode: initialEditMode,
}: Props) {
  const [datasheet, setDatasheet] = useState(template.datasheet);
  const [equipment, setEquipment] = useState(template.equipment);
  const [subsheets, setSubsheets] = useState(template.subsheets);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);

  const {
    areas,
    users,
    manufacturers,
    suppliers,
    categories,
    clients,
    projects,
  } = referenceOptions;

  const getName = (arr: { id: number; name: string }[], id: number) =>
    arr.find((x) => x.id === id)?.name ?? "-";

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/backend/datasheets/${templateId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasheet, equipment, subsheets }),
      });
      if (!res.ok) throw new Error("Request failed");
      const result = await res.json();
      if (result.success) {
        alert("✅ Template updated successfully!");
        window.location.reload();
      } else {
        alert("❌ Failed to update template.");
      }
    } catch (err) {
      alert("❌ Error during save.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Client Logo and Header */}
      <div className="flex items-center gap-4 mb-6">
        <Image
            src={`/clients/${datasheet?.clientLogo ?? "default-logo.png"}`}
            alt={`datasheet?.clientName ?? "Client"}`}
            width={64}
            height={64}
            className="object-contain rounded-md border"
        />
        <div>
            {isEditMode ? (
        <>
            <input
            type="text"
            value={datasheet.sheetName ?? ""}
            onChange={(e) =>
                setDatasheet((prev) => ({ ...prev, sheetName: e.target.value }))
            }
            className="text-3xl font-bold text-gray-900 dark:text-gray-100 w-full bg-white dark:bg-gray-800 border rounded px-2 py-1"
            aria-label="Sheet Name"
            />
            <input
            type="text"
            value={datasheet.sheetDesc ?? ""}
            onChange={(e) =>
                setDatasheet((prev) => ({ ...prev, sheetDesc: e.target.value }))
            }
            className="text-lg text-gray-700 dark:text-gray-300 w-full mt-1 bg-white dark:bg-gray-800 border rounded px-2 py-1"
            aria-label="Sheet Description"
            />
            <input
            type="text"
            value={datasheet.sheetDesc2 ?? ""}
            onChange={(e) =>
                setDatasheet((prev) => ({ ...prev, sheetDesc2: e.target.value }))
            }
            className="text-sm text-gray-500 dark:text-gray-400 w-full mt-1 bg-white dark:bg-gray-800 border rounded px-2 py-1"
            aria-label="Sheet Description 2"
            />
        </>
        ) : (
        <>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {datasheet.sheetName}
            </h1>
            <h2 className="text-lg text-gray-700 dark:text-gray-300">
            {datasheet.sheetDesc}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
            {datasheet.sheetDesc2}
            </p>
        </>
        )}
        </div>
      </div>

      {/* 🆕 Button Row */}
        <div className="flex justify-between items-center mb-4">
            {/* Left buttons */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={async () => {
                    try {
                        await handleExport({
                        sheetId: templateId,
                        type: "pdf",
                        unitSystem: "SI",
                        language: "eng",
                        sheetName: datasheet.sheetName,
                        revisionNum: datasheet.revisionNum
                        });
                    } catch (err) {
                        console.error(err);
                        alert("❌ Export PDF failed");
                    }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Export PDF
                </button>
                <button
                    type="button"
                    onClick={async () => {
                    try {
                        await handleExport({
                        sheetId: templateId,
                        type: "excel",
                        unitSystem: "SI",
                        language: "eng",
                        sheetName: datasheet.sheetName,
                        revisionNum: datasheet.revisionNum
                        });
                    } catch (err) {
                        console.error(err);
                        alert("❌ Export Excel failed");
                    }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                    Export Excel
                </button>
            </div>

            {/* Right buttons */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="px-4 py-2 text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition"
                >
                    {isEditMode ? "Exit Edit Mode" : "Edit Template"}
                </button>
                <button
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    onClick={async () => {
                    if (!window.confirm("Create filled datasheet from this template?")) return;
                    try {
                        const res = await fetch(`/api/backend/datasheets/templates/${templateId}/create-filled`, {
                        method: "POST",
                        });
                        const data = await res.json();
                        if (data?.sheetId) {
                        window.location.href = `/datasheets/filled/${data.sheetId}`;
                        }
                    } catch (err) {
                        console.error(err);
                        alert("❌ Failed to create filled datasheet.");
                    }
                    }}
                >
                    Create Filled Datasheet
                </button>
            </div>
        </div>

      {/* 🔹 Datasheet Info */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">DataSheet Details</h2>
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
          <tbody>
            <tr>
                <td className="font-semibold px-4 py-2 border">Client Document #</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="number"
                        value={datasheet.clientDoc ?? 0}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            clientDoc: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Client Document Number"
                    />
                    ) : (
                    datasheet.clientDoc ?? "-"
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Company Document #</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="number"
                        value={datasheet.companyDoc ?? 0}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            companyDoc: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Company Document Number"
                    />
                    ) : (
                    datasheet.companyDoc ?? "-"
                    )}
                </td>
                </tr>

                <tr>
                <td className="font-semibold px-4 py-2 border">Client Project #</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="number"
                        value={datasheet.clientProject ?? 0}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            clientProject: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Client Project Number"
                    />
                    ) : (
                    datasheet.clientProject ?? "-"
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Company Project #</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="number"
                        value={datasheet.companyProject ?? 0}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            companyProject: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Company Project Number"
                    />
                    ) : (
                    datasheet.companyProject ?? "-"
                    )}
                </td>
                </tr>

                <tr>
                <td className="font-semibold px-4 py-2 border">Area</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <select
                        value={datasheet.areaId}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            areaId: Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Area"
                    >
                        <option value="">Select</option>
                        {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.name}
                        </option>
                        ))}
                    </select>
                    ) : (
                    getName(areas, datasheet.areaId)
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Package Name</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="text"
                        value={datasheet.packageName ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            packageName: e.target.value,
                        }))
                        }
                        className="input"
                        aria-label="Package Name"
                    />
                    ) : (
                    datasheet.packageName
                    )}
                </td>
              </tr>
              <tr>
                <td className="font-semibold px-4 py-2 border">Revision #</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="number"
                        value={datasheet.revisionNum ?? 0}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            revisionNum: Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Revision Number"
                    />
                    ) : (
                    datasheet.revisionNum
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Revision Date</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="date"
                        value={datasheet.revisionDate ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            revisionDate: e.target.value,
                        }))
                        }
                        className="input"
                        aria-label="Revision Date"
                    />
                    ) : (
                    datasheet.revisionDate
                    )}
                </td>
                </tr>

                <tr>
                <td className="font-semibold px-4 py-2 border">Prepared By</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <select
                        value={datasheet.preparedBy}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            preparedBy: Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Prepared By"
                    >
                        <option value="">Select</option>
                        {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                        ))}
                    </select>
                    ) : (
                    getName(users, datasheet.preparedBy)
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Prepared Date</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="date"
                        value={datasheet.preparedDate ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            preparedDate: e.target.value,
                        }))
                        }
                        className="input"
                        aria-label="Prepared Date"
                    />
                    ) : (
                    datasheet.preparedDate
                    )}
                </td>
                </tr>

                <tr>
                <td className="font-semibold px-4 py-2 border">Verified By</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <select
                        value={datasheet.verifiedBy ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            verifiedBy: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Verified By"
                    >
                        <option value="">Select</option>
                        {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                        ))}
                    </select>
                    ) : (
                    getName(users, datasheet.verifiedBy ?? -1)
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Verified Date</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="date"
                        value={datasheet.verifiedDate ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            verifiedDate: e.target.value || undefined,
                        }))
                        }
                        className="input"
                        aria-label="Verified Date"
                    />
                    ) : (
                    datasheet.verifiedDate ?? "-"
                    )}
                </td>
                </tr>

                <tr>
                <td className="font-semibold px-4 py-2 border">Approved By</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <select
                        value={datasheet.approvedBy ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            approvedBy: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                        }
                        className="input"
                        aria-label="Approved By"
                    >
                        <option value="">Select</option>
                        {users.map((u) => (
                        <option key={u.id} value={u.id}>
                            {u.name}
                        </option>
                        ))}
                    </select>
                    ) : (
                    getName(users, datasheet.approvedBy ?? -1)
                    )}
                </td>
                <td className="font-semibold px-4 py-2 border">Approved Date</td>
                <td className="px-4 py-2 border">
                    {isEditMode ? (
                    <input
                        type="date"
                        value={datasheet.approvedDate ?? ""}
                        onChange={(e) =>
                        setDatasheet((prev) => ({
                            ...prev,
                            approvedDate: e.target.value || undefined,
                        }))
                        }
                        className="input"
                    aria-label="Approved Date"
                    />
                    ) : (
                    datasheet.approvedDate ?? "-"
                    )}
                </td>
                </tr>

          </tbody>
        </table>
      </div>

      {/* 🔹 Equipment Info */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md w-full overflow-x-auto">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">DataSheet Details</h2>
        <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">
            <tbody>
                <tr>    
                    <td className="font-semibold px-4 py-2 border">Equipment Name</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        type="text"
                        value={equipment.equipmentName ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            equipmentName: e.target.value,
                            }))
                        }
                        className="input"
                        aria-label="Equipment Name"
                        />
                    ) : (
                        equipment.equipmentName
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Equipment Size</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        type="number"
                        value={equipment.equipSize ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            equipSize: e.target.value === "" ? undefined : Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Equipment Size"
                        />
                    ) : (
                        equipment.equipSize
                    )}
                    </td>
                </tr>
                <tr>    
                    <td className="font-semibold px-4 py-2 border">Equipment Tag Number</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        type="text"
                        value={equipment.equipmentTagNum ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            equipmentTagNum: e.target.value,
                            }))
                        }
                        className="input"
                        aria-label="Equipment Tag Number"
                        />
                    ) : (
                        equipment.equipmentTagNum
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Install Pack #</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.installPackNum}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            installPackNum: e.target.value,
                            }))
                        }
                        className="input"
                        aria-label="Installation Package Number"
                        />
                    ) : (
                        equipment.installPackNum
                    )}
                    </td>
                </tr>
                <tr>
                    <td className="font-semibold px-4 py-2 border">Service Name</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        type="text"
                        value={equipment.serviceName ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            serviceName: e.target.value,
                            }))
                        }
                        className="input"
                        aria-label="Service Name"
                        />
                    ) : (
                        equipment.serviceName
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Model #</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.modelNum}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            modelNum: e.target.value,
                            }))
                        }
                        className="input"
                        aria-label="Model Number"
                        />
                    ) : (
                        equipment.modelNum
                    )}
                    </td>
                </tr>
                <tr>
                    <td className="font-semibold px-4 py-2 border">Client</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <select
                        value={equipment.clientId}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            clientId: Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Client"
                        >
                        <option value="">Select</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>
                            {c.name}
                            </option>
                        ))}
                        </select>
                    ) : (
                        getName(clients, equipment.clientId)
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">PID</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        type="number"
                        value={equipment.pid ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            pid: e.target.value === "" ? undefined : Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="PID"
                        />
                    ) : (
                        equipment.pid ?? "-"
                    )}
                    </td>
                </tr>
                <tr>
                    <td className="font-semibold px-4 py-2 border">Project</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <select
                        value={equipment.projectId}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            projectId: Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Project"
                        >
                        <option value="">Select</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                            {p.name}
                            </option>
                        ))}
                        </select>
                    ) : (
                        getName(projects, equipment.projectId)
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Code / Std</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.codeStd ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            codeStd: e.target.value || undefined,
                            }))
                        }
                        className="input"
                        aria-label="Code / Std"
                        />
                    ) : (
                        equipment.codeStd ?? "-"
                    )}
                    </td>
                </tr>
                <tr>
                    <td className="font-semibold px-4 py-2 border">Category</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <select
                        value={equipment.categoryId}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            categoryId: Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Category"
                        >
                        <option value="">Select</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                            {c.name}
                            </option>
                        ))}
                        </select>
                    ) : (
                        getName(categories, equipment.categoryId)
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Item Location</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.itemLocation}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            itemLocation: e.target.value,
                            }))
                        }
                        className="input"
                        aria-label="Item Location"
                        />
                    ) : (
                        equipment.itemLocation
                    )}
                    </td>
                </tr>

                <tr>
                    <td className="font-semibold px-4 py-2 border">Manufacturer</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <select
                        value={equipment.manufacturerId}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            manufacturerId: Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Manufacturer"
                        >
                        <option value="">Select</option>
                        {manufacturers.map((m) => (
                            <option key={m.id} value={m.id}>
                            {m.name}
                            </option>
                        ))}
                        </select>
                    ) : (
                        getName(manufacturers, equipment.manufacturerId)
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Location DWG</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.locationDWG ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            locationDWG: e.target.value || undefined,
                            }))
                        }
                        className="input"
                        aria-label="Location DWG"
                        />
                    ) : (
                        equipment.locationDWG ?? "-"
                    )}
                    </td>
                </tr>

                <tr>
                    <td className="font-semibold px-4 py-2 border">Supplier</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <select
                        value={equipment.supplierId}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            supplierId: Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Supplier"
                        >
                        <option value="">Select</option>
                        {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                            {s.name}
                            </option>
                        ))}
                        </select>
                    ) : (
                        getName(suppliers, equipment.supplierId)
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Install DWG</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.installDWG ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            installDWG: e.target.value || undefined,
                            }))
                        }
                        className="input"
                        aria-label="Install DWG"
                        />
                    ) : (
                        equipment.installDWG ?? "-"
                    )}
                    </td>
                </tr>
                <tr>
                    <td className="font-semibold px-4 py-2 border">Required Quantity</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        type="number"
                        value={equipment.requiredQty ?? 0}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            requiredQty: Number(e.target.value),
                            }))
                        }
                        className="input"
                        aria-label="Required Quantity"
                        />
                    ) : (
                        equipment.requiredQty
                    )}
                    </td>
                    <td className="font-semibold px-4 py-2 border">Driver</td>
                    <td className="px-4 py-2 border">
                    {isEditMode ? (
                        <input
                        value={equipment.driver ?? ""}
                        onChange={(e) =>
                            setEquipment((prev) => ({
                            ...prev,
                            driver: e.target.value || undefined,
                            }))
                        }
                        className="input"
                        aria-label="Driver"
                        />
                    ) : (
                        equipment.driver ?? "-"
                    )}
                    </td>
                </tr>
                </tbody>
        </table>
      </div>

      {/* 🔹 SubSheets (already working) */}
      <SubsheetBuilder
        subsheets={subsheets}
        onChange={setSubsheets}
        isEditMode={isEditMode}
      />

      {/* Bottom of the page */}
      {isEditMode && (
        <div className="text-right mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`px-4 py-2 rounded text-white ${
              isSaving ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

    </div>
  );
}

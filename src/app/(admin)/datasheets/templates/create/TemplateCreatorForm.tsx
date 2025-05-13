'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import SubsheetBuilder from '@/components/datasheets/templates/SubsheetBuilder';
import { fullTemplateSchema } from '@/validation/datasheetTemplateSchema';
import { validateForm } from '@/validation/validationHelpers';
import { formatZodError } from "@/validation/validationHelpers";
import type { Subsheet } from '@/types/datasheetTypes';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type {
  DatasheetInput,
  EquipmentInput,
  FullTemplateInput,
} from '@/validation/datasheetTemplateSchema';

type Option = { id: number; name: string };

type Props = {
  areas: Option[];
  users: Option[];
  manufacturers: Option[];
  suppliers: Option[];
  categories: Option[];
  projects: Option[];
  clients: Option[];
};

export default function TemplateCreatorForm({
  areas,
  users,
  manufacturers,
  suppliers,
  categories,
  projects,
  clients,
}: Props) {
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];

  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({});
  const [subsheets, setSubsheets] = useState<Subsheet[]>([
    {
      id: Date.now(),
      name: 'Subsheet Name',
      templates: [],
    },
  ]);
  const [isPreview, setIsPreview] = useState(false);

  const [datasheet, setDatasheet] = useState<DatasheetInput>({
    sheetName: '',
    sheetDesc: '',
    sheetDesc2: '',
    clientDoc: undefined,
    clientProject: undefined,
    companyDoc: undefined,
    companyProject: undefined,
    areaId: 0,
    packageName: '',
    revisionNum: 1,
    preparedBy: 0,
    preparedDate: today,
    verifiedBy: undefined,
    verifiedDate: '',
    approvedBy: undefined,
    approvedDate: '',
  });

  const [equipment, setEquipment] = useState<EquipmentInput>({
    requiredQty: 1,
    itemLocation: '',
    manufacturerId: 0,
    supplierId: 0,
    installPackNum: '',
    modelNum: '',
    driver: '',
    locationDWG: '',
    pid: 0,
    installDWG: '',
    codeStd: '',
    categoryId: 0,
    clientId: 0,
    projectId: 0,
    equipmentName: '',
    equipmentTagNum: '',
    serviceName: '',
    equipSize: 0,
  });

  const fieldLabels: Record<string, string> = {
    sheetName: "Sheet Name",
    sheetDescription: "Sheet Description",
    categoryId: "Category",
    projectId: "Project",
    clientId: "Client",
    clientDoc: "Client Document #",
    clientProject: "Client Project #",
    companyDoc: "Company Document #",
    companyProject: "Company Project #",
    preparedById: "Prepared By",
    preparedDate: "Prepared Date",
    checkedById: "Checked By",
    checkedDate: "Checked Date",
    approvedById: "Approved By",
    approvedDate: "Approved Date",
    manuId: "Manufacturer",
    suppId: "Supplier",
    areaId: "Area",
    equipmentName: "Equipment Name",
    equipmentTag: "Tag #",
    equipmentType: "Equipment Type",
    equipmentService: "Service",
    pid: "P&ID #",
  };

  const handleDatasheetChange = (field: keyof DatasheetInput, value: string | number | undefined) => {
    setDatasheet((prev) => ({ ...prev, [field]: value }));
  };
  
  const handleEquipmentChange = (field: keyof EquipmentInput, value: string | number | undefined) => {
    setEquipment((prev) => ({ ...prev, [field]: value }));
  };

  const togglePreview = () => setIsPreview((prev) => !prev);

  const handleSubmit = async () => {
    const errors = validateForm(datasheet, equipment);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      const errorFields = Object.keys(errors)
        .map((key) => fieldLabels[key] || key)
        .join(", ");
      alert(
        `Please correct the following fields:\n\n` +
        errorFields
          .split(', ')
          .map((field) => `• ${field}`)
          .join('\n')
      );
      return;
    }

    const payload: FullTemplateInput = {
      datasheet,
      equipment,
      subsheets,
    };

    const result = fullTemplateSchema.safeParse(payload);

    if (!result.success) {
      const { fieldErrors } = result.error.flatten();
      setFormErrors(fieldErrors);
    
      console.log("❌ Validation failed:", result.error.format());
    
      alert(
        "Please fix the following invalid fields:\n" +
        formatZodError(fieldErrors)
      );
      return;
    }

    try {
      const res = await fetch('/api/datasheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      if (!res.ok) throw new Error('Server responded with error');

      const data = await res.json();
      if (data.success && data.sheetId) {
        alert(`✅ Template saved! Redirecting...`);
        router.push(`/datasheets/templates/${data.sheetId}`);
      } else {
        throw new Error('Unexpected API response');
      }
    } catch (error) {
      console.error('⛔ Submit error:', error);
      alert('Something went wrong while saving.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">
          {isPreview ? 'Preview Datasheet Template' : 'Create Datasheet Template'}
        </h2>
        <button
          type="button"
          onClick={togglePreview}
          className="text-sm text-blue-600 hover:underline"
        >
          {isPreview ? 'Back to Edit' : 'Preview'}
        </button>
      </div>

      {!isPreview ? (
        <form className="space-y-6">
          {/* 🔹 Datasheet Details */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-semibold text-blue-700">Datasheet Details</legend>
            <div className="grid grid-cols-2 gap-4 mt-4">

              {/* Sheet Name */}
              <div>
                <label className="text-sm font-medium text-gray-700">Sheet Name</label>
                <input
                  type="text" 
                  placeholder="Sheet Name"
                  className={`input ${formErrors.sheetName?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.sheetName }
                  onChange={(e) => handleDatasheetChange("sheetName", e.target.value)}
                />
                {formErrors.sheetName?.[0] && ( <p className="text-red-500 text-xs">{formErrors.sheetName[0]}</p> )}
              </div>

              {/* Sheet Description */}
              <div>
                <label className="text-sm font-medium text-gray-700">Sheet Description</label>
                <input
                  type="text" 
                  placeholder="Sheet Description"
                  className={`input ${formErrors.sheetDesc?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.sheetDesc }
                  onChange={(e) => handleDatasheetChange("sheetDesc", e.target.value)}
                />
                {formErrors.sheetDesc?.[0] && ( <p className="text-red-500 text-xs">{formErrors.sheetDesc[0]}</p> )}
              </div>

              {/* Additional Sheet Description */}
              <div>
                <label className="text-sm font-medium text-gray-700">Additional Sheet Description</label>
                <input
                  type="text" 
                  placeholder="Additional Sheet Description"
                  className={`input ${formErrors.sheetDesc2?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.sheetDesc2 }
                  onChange={(e) => handleDatasheetChange("sheetDesc2", e.target.value)}
                />
                {formErrors.sheetDesc2?.[0] && ( <p className="text-red-500 text-xs">{formErrors.sheetDesc2[0]}</p> )}
              </div>

              {/* Client Doc */}
              <div>
                <label className="text-sm font-medium text-gray-700">Client Document Number</label>
                <input
                  type="number" 
                  placeholder="Client Doc #"
                  className={`input ${formErrors.clientDoc?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.clientDoc ?? ''}
                  onChange={(e) => handleDatasheetChange("clientDoc", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.clientDoc?.[0] && ( <p className="text-red-500 text-xs">{formErrors.clientDoc[0]}</p> )}
              </div>

              {/* Client Project */}
              <div>
                <label className="text-sm font-medium text-gray-700">Client Project Number</label>
                <input
                  type="number" 
                  placeholder="Client Project #"
                  className={`input ${formErrors.clientProject?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.clientProject ?? ''}
                  onChange={(e) => handleDatasheetChange("clientProject", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.clientProject?.[0] && ( <p className="text-red-500 text-xs">{formErrors.clientProject[0]}</p> )}
              </div>

              {/* Company Doc */}
              <div>
                <label className="text-sm font-medium text-gray-700">Company Document Number</label>
                <input
                  type="number" 
                  placeholder="Company Doc #"
                  className={`input ${formErrors.companyDoc?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.companyDoc ?? ''}
                  onChange={(e) => handleDatasheetChange("companyDoc", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.companyDoc?.[0] && ( <p className="text-red-500 text-xs">{formErrors.companyDoc[0]}</p> )}
              </div>

              {/* Company Project */}
              <div>
                <label className="text-sm font-medium text-gray-700">Company Project Number</label>
                <input
                  type="number" 
                  placeholder="Company Project #"
                  className={`input ${formErrors.companyProject?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.companyProject ?? ''}
                  onChange={(e) => handleDatasheetChange("companyProject", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.companyProject?.[0] && ( <p className="text-red-500 text-xs">{formErrors.companyProject[0]}</p> )}
              </div>

              {/* Area */}
              <div>
                <label className="text-sm font-medium text-gray-700">Area</label>
                <select
                  className={`input ${formErrors.areaId?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.areaId}
                  onChange={(e) => handleDatasheetChange("areaId", e.target.value)}
                  aria-label="Area"
                >
                  <option value="">Select Area</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
                {formErrors.areaId?.[0] && ( <p className="text-red-500 text-xs">{formErrors.areaId[0]}</p> )}
              </div>

              {/* Package Name */}
              <div>
                <label className="text-sm font-medium text-gray-700">Package Name</label>
                <input
                  placeholder="Package Name"
                  className={`input ${formErrors.packageName?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.packageName}
                  onChange={(e) => handleDatasheetChange("packageName", e.target.value)}
                />
                {formErrors.packageName?.[0] && ( <p className="text-red-500 text-xs">{formErrors.packageName[0]}</p> )}
              </div>

              {/* Revision Number */}
              <div>
                <label className="text-sm font-medium text-gray-700">Revision Number</label>
                <input
                  type="number"
                  placeholder="Revision #"
                  className={`input ${formErrors.revisionNum?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.revisionNum ?? ''}
                  onChange={(e) => handleDatasheetChange("revisionNum", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.revisionNum?.[0] && ( <p className="text-red-500 text-xs">{formErrors.revisionNum[0]}</p> )}
              </div>

              {/* Prepared Date */}
              <div>
                <label className="text-sm font-medium text-gray-700">Date Prepared</label>
                <DatePicker
                  selected={datasheet.preparedDate ? new Date(datasheet.preparedDate) : null}
                  onChange={(date: Date | null) =>
                    handleDatasheetChange("preparedDate", date ? date.toISOString().split('T')[0] : '')
                  }
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select a date"
                  className={`input w-full ${formErrors.preparedDate?.[0] ? "border-red-500" : ""}`}
                />
                {formErrors.preparedDate?.[0] && ( <p className="text-red-500 text-xs">{formErrors.preparedDate[0]}</p> )}
              </div>

              {/* Prepared By */}
              <div>
                <label className="text-sm font-medium text-gray-700">Prepared By</label>
                <select
                  className={`input ${formErrors.preparedBy?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.preparedBy}
                  onChange={(e) => handleDatasheetChange("preparedBy", e.target.value)}
                  aria-label="Prepared By"
                >
                  <option value="">Prepared By</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {formErrors.preparedBy?.[0] && ( <p className="text-red-500 text-xs">{formErrors.preparedBy[0]}</p> )}
              </div>

              {/* Verified Date */}
              <div>
                <label className="text-sm font-medium text-gray-700">Date Verified</label>
                <DatePicker
                  selected={datasheet.verifiedDate ? new Date(datasheet.verifiedDate) : null}
                  onChange={(date: Date | null) =>
                    handleDatasheetChange("verifiedDate", date ? date.toISOString().split('T')[0] : '')
                  }
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select a date"
                  className={`input w-full ${formErrors.verifiedDate?.[0] ? "border-red-500" : ""}`}
                />
                {formErrors.verifiedDate?.[0] && ( <p className="text-red-500 text-xs">{formErrors.verifiedDate[0]}</p> )}
              </div>

              {/* Verified By */}
              <div>
                <label className="text-sm font-medium text-gray-700">Verified By</label>
                <select
                  className={`input ${formErrors.verifiedBy?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.verifiedBy}
                  onChange={(e) => handleDatasheetChange("verifiedBy", e.target.value)}
                  aria-label="Verified By"
                >
                  <option value="">Verified By</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {formErrors.verifiedBy?.[0] && ( <p className="text-red-500 text-xs">{formErrors.verifiedBy[0]}</p> )}
              </div>

              {/* Approved Date */}
              <div>
                <label className="text-sm font-medium text-gray-700">Date Approved</label>
                <DatePicker
                  selected={datasheet.approvedDate ? new Date(datasheet.approvedDate) : null}
                  onChange={(date: Date | null) =>
                    handleDatasheetChange("approvedDate", date ? date.toISOString().split('T')[0] : '')
                  }
                  dateFormat="yyyy-MM-dd"
                  placeholderText="Select a date"
                  className={`input w-full ${formErrors.approvedDate?.[0] ? "border-red-500" : ""}`}
                />
                {formErrors.approvedDate?.[0] && ( <p className="text-red-500 text-xs">{formErrors.approvedDate[0]}</p> )}
              </div>

              {/* Approved By */}
              <div>
                <label className="text-sm font-medium text-gray-700">Approved By</label>
                <select
                  className={`input ${formErrors.approvedBy?.[0] ? "border-red-500" : ""}`}
                  value={datasheet.approvedBy}
                  onChange={(e) => handleDatasheetChange("approvedBy", e.target.value)}
                  aria-label="Approved By"
                >
                  <option value="">Approved By</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {formErrors.approvedBy?.[0] && ( <p className="text-red-500 text-xs">{formErrors.approvedBy[0]}</p> )}
              </div>
            </div>
          </fieldset>
    
          {/* 🔹 Equipment Details */}
          <fieldset className="border p-4 rounded-md">
            <legend className="text-lg font-semibold text-blue-700">Equipment Details</legend>
            <div className="grid grid-cols-2 gap-4 mt-4">

              {/* Equipment Name */}
              <div>
                <label className="text-sm font-medium text-gray-700">Equipment Name</label>
                <input
                  type="text"
                  placeholder="Equipment Name"
                  className={`input ${formErrors.equipmentName?.[0] ? "border-red-500" : ""}`}
                  value={equipment.equipmentName}
                  onChange={(e) => handleEquipmentChange("equipmentName", e.target.value)}
                />
                {formErrors.equipmentName?.[0] && ( <p className="text-red-500 text-xs">{formErrors.equipmentName[0]}</p> )}
              </div>

              {/* Equipment Tag Number */}
              <div>
                <label className="text-sm font-medium text-gray-700">Equipment Tag Number</label>
                <input
                  type="text"
                  placeholder="Equipment Tag #"
                  className={`input ${formErrors.equipmentTagNum?.[0] ? "border-red-500" : ""}`}
                  value={equipment.equipmentTagNum}
                  onChange={(e) => handleEquipmentChange("equipmentTagNum", e.target.value)}
                />
                {formErrors.equipmentTagNum?.[0] && ( <p className="text-red-500 text-xs">{formErrors.equipmentTagNum[0]}</p> )}
              </div>

              {/* Service Name */}
              <div>
                <label className="text-sm font-medium text-gray-700">Service Name</label>
                <input
                  type="text"
                  placeholder="Service Name"
                  className={`input ${formErrors.serviceName?.[0] ? "border-red-500" : ""}`}
                  value={equipment.serviceName}
                  onChange={(e) => handleEquipmentChange("serviceName", e.target.value)}
                />
                {formErrors.serviceName?.[0] && ( <p className="text-red-500 text-xs">{formErrors.serviceName[0]}</p> )}
              </div>

              {/* Equipment Size */}
              <div>
                <label className="text-sm font-medium text-gray-700">Equipment Size</label>
                <input
                  type="number"
                  placeholder="Equipment Size"
                  className={`input ${formErrors.equipSize?.[0] ? "border-red-500" : ""}`}
                  value={equipment.equipSize ?? ''}
                  onChange={(e) => handleEquipmentChange("equipSize", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.equipSize?.[0] && ( <p className="text-red-500 text-xs">{formErrors.equipSize[0]}</p> )}
              </div>
  
              {/* Required Qty */}
              <div>
                <label className="text-sm font-medium text-gray-700">Required Quantity</label>
                <input
                  type="number"
                  placeholder="Required Qty"
                  className={`input ${formErrors.requiredQty?.[0] ? "border-red-500" : ""}`}
                  value={equipment.requiredQty ?? ''}
                  onChange={(e) => handleEquipmentChange("requiredQty", e.target.value === '' ? undefined : Number(e.target.value))}
                />
                {formErrors.requiredQty?.[0] && ( <p className="text-red-500 text-xs">{formErrors.requiredQty[0]}</p> )}
              </div>

              {/* Item Location */}
              <div>
                <label className="text-sm font-medium text-gray-700">Item Location</label>
                <input
                  placeholder="Item Location"
                  className={`input ${formErrors.itemLocation?.[0] ? "border-red-500" : ""}`}
                  value={equipment.itemLocation}
                  onChange={(e) => handleEquipmentChange("itemLocation", e.target.value)}
                />
                {formErrors.itemLocation?.[0] && ( <p className="text-red-500 text-xs">{formErrors.itemLocation[0]}</p> )}
              </div>

              {/* Manufacturer */}
              <div>
                <label className="text-sm font-medium text-gray-700">Manufacturer</label>
                <select
                  className={`input ${formErrors.manufacturerId?.[0] ? "border-red-500" : ""}`}
                  value={equipment.manufacturerId}
                  onChange={(e) => handleEquipmentChange("manufacturerId", e.target.value)}
                  aria-label="Manufacturer"
                >
                  <option value="">Manufacturer</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {formErrors.manufacturerId?.[0] && ( <p className="text-red-500 text-xs">{formErrors.manufacturerId[0]}</p> )}
              </div>

              {/* Supplier */}
              <div>
                <label className="text-sm font-medium text-gray-700">Supplier</label>
                <select
                  className={`input ${formErrors.supplierId?.[0] ? "border-red-500" : ""}`}
                  value={equipment.supplierId}
                  onChange={(e) => handleEquipmentChange("supplierId", e.target.value)}
                  aria-label="Supplier"
                >
                  <option value="">Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                {formErrors.supplierId?.[0] && ( <p className="text-red-500 text-xs">{formErrors.supplierId[0]}</p> )}
              </div>

              {/* Install Pack # */}
              <div>
                <label className="text-sm font-medium text-gray-700">Installation Package Number</label>
                <input
                  placeholder="Install Pack #"
                  className={`input ${formErrors.installPackNum?.[0] ? "border-red-500" : ""}`}
                  value={equipment.installPackNum}
                  onChange={(e) => handleEquipmentChange("installPackNum", e.target.value)}
                />
                {formErrors.installPackNum?.[0] && ( <p className="text-red-500 text-xs">{formErrors.installPackNum[0]}</p> )}
              </div>

              {/* Model # */}
              <div>
                <label className="text-sm font-medium text-gray-700">Model Number</label>
                <input
                  placeholder="Model #"
                  className={`input ${formErrors.modelNum?.[0] ? "border-red-500" : ""}`}
                  value={equipment.modelNum}
                  onChange={(e) => handleEquipmentChange("modelNum", e.target.value)}
                />
                {formErrors.modelNum?.[0] && ( <p className="text-red-500 text-xs">{formErrors.modelNum[0]}</p> )}
              </div>

              {/* Driver */}
              <div>
                <label className="text-sm font-medium text-gray-700">Driver</label>
                <input
                  placeholder="Driver"
                  className={`input ${formErrors.driver?.[0] ? "border-red-500" : ""}`}
                  value={equipment.driver}
                  onChange={(e) => handleEquipmentChange("driver", e.target.value)}
                />
                {formErrors.driver?.[0] && ( <p className="text-red-500 text-xs">{formErrors.driver[0]}</p> )}
              </div>

              {/* Location DWG */}
              <div>
                <label className="text-sm font-medium text-gray-700">Location DWG</label>
                <input
                  placeholder="Location DWG"
                  className={`input ${formErrors.locationDWG?.[0] ? "border-red-500" : ""}`}
                  value={equipment.locationDWG}
                  onChange={(e) => handleEquipmentChange("locationDWG", e.target.value)}
                />
                {formErrors.locationDWG?.[0] && ( <p className="text-red-500 text-xs">{formErrors.locationDWG[0]}</p> )}
              </div>

              {/* PID */}
              <div>
                <label className="text-sm font-medium text-gray-700">PID</label>
                <input
                  placeholder="PID"
                  className={`input ${formErrors.pid?.[0] ? "border-red-500" : ""}`}
                  value={equipment.pid}
                  onChange={(e) => handleEquipmentChange("pid", e.target.value)}
                />
                {formErrors.pid?.[0] && ( <p className="text-red-500 text-xs">{formErrors.pid[0]}</p> )}
              </div>

              {/* Install DWG */}
              <div>
                <label className="text-sm font-medium text-gray-700">Installation DWG</label>
                <input
                  placeholder="Install DWG"
                  className={`input ${formErrors.installDWG?.[0] ? "border-red-500" : ""}`}
                  value={equipment.installDWG}
                  onChange={(e) => handleEquipmentChange("installDWG", e.target.value)}
                />
                {formErrors.installDWG?.[0] && ( <p className="text-red-500 text-xs">{formErrors.installDWG[0]}</p> )}
              </div>

              {/* Code/Std */}
              <div>
                <label className="text-sm font-medium text-gray-700">Code/Std</label>
                <input
                  placeholder="Code/Std"
                  className={`input ${formErrors.codeStd?.[0] ? "border-red-500" : ""}`}
                  value={equipment.codeStd}
                  onChange={(e) => handleEquipmentChange("codeStd", e.target.value)}
                />
                {formErrors.codeStd?.[0] && ( <p className="text-red-500 text-xs">{formErrors.codeStd[0]}</p> )}
              </div>

              {/* Category */}
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <select
                  className={`input ${formErrors.categoryId?.[0] ? "border-red-500" : ""}`}
                  value={equipment.categoryId}
                  onChange={(e) => handleEquipmentChange("categoryId", e.target.value)}
                  aria-label="Category"
                >
                  <option value="">Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {formErrors.categoryId?.[0] && ( <p className="text-red-500 text-xs">{formErrors.categoryId[0]}</p> )}
              </div>

              {/* Client */}
              <div>
                <label className="text-sm font-medium text-gray-700">Client</label>
                <select
                  className={`input ${formErrors.clientId?.[0] ? "border-red-500" : ""}`}
                  value={equipment.clientId}
                  onChange={(e) => handleEquipmentChange("clientId", e.target.value)}
                  aria-label="Client"
                >
                  <option value="">Client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {formErrors.clientId?.[0] && ( <p className="text-red-500 text-xs">{formErrors.clientId[0]}</p> )}
              </div>

              {/* Project */}
              <div>
                <label className="text-sm font-medium text-gray-700">Project</label>
                <select
                  className={`input ${formErrors.projectId?.[0] ? "border-red-500" : ""}`}
                  value={equipment.projectId}
                  onChange={(e) => handleEquipmentChange("projectId", e.target.value)}
                  aria-label="Project"
                >
                  <option value="">Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {formErrors.projectId?.[0] && ( <p className="text-red-500 text-xs">{formErrors.projectId[0]}</p> )}
              </div>

            </div>
          </fieldset>

          {/* ✅ Subsheet Builder */}
          <SubsheetBuilder
            subsheets={subsheets}
            onChange={setSubsheets}
            isEditMode={true}
            formErrors={formErrors}
          />

          <div className="text-right mt-6">
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Save Template
            </button>
          </div>
        </form>
      ) : (
        // ---------- PREVIEW MODE ----------
        <div className="space-y-8 text-sm">
          {/* 🔹 Datasheet Details Preview */}
          <div className="border rounded-md p-4 bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-blue-800">Datasheet Details</h3>
            <table className="w-full mt-3 border text-sm">
              <tbody>
                <tr><td className="border p-2 font-medium">Sheet Name</td><td className="border p-2">{datasheet.sheetName}</td></tr>
                <tr><td className="border p-2 font-medium">Sheet Description</td><td className="border p-2">{datasheet.sheetDesc}</td></tr>
                <tr><td className="border p-2 font-medium">Additional Description</td><td className="border p-2">{datasheet.sheetDesc2}</td></tr>
                <tr><td className="border p-2 font-medium">Client Doc #</td><td className="border p-2">{datasheet.clientDoc}</td></tr>
                <tr><td className="border p-2 font-medium">Client Project #</td><td className="border p-2">{datasheet.clientProject}</td></tr>
                <tr><td className="border p-2 font-medium">Company Doc #</td><td className="border p-2">{datasheet.companyDoc}</td></tr>
                <tr><td className="border p-2 font-medium">Company Project #</td><td className="border p-2">{datasheet.companyProject}</td></tr>
                <tr><td className="border p-2 font-medium">Area</td><td className="border p-2">{areas.find(a => a.id === Number(datasheet.areaId))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Package Name</td><td className="border p-2">{datasheet.packageName}</td></tr>
                <tr><td className="border p-2 font-medium">Revision #</td><td className="border p-2">{datasheet.revisionNum}</td></tr>
                <tr><td className="border p-2 font-medium">Prepared By</td><td className="border p-2">{users.find(u => u.id === Number(datasheet.preparedBy))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Prepared Date</td><td className="border p-2">{datasheet.preparedDate}</td></tr>
                <tr><td className="border p-2 font-medium">Verified By</td><td className="border p-2">{users.find(u => u.id === Number(datasheet.verifiedBy))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Verified Date</td><td className="border p-2">{datasheet.verifiedDate}</td></tr>
                <tr><td className="border p-2 font-medium">Approved By</td><td className="border p-2">{users.find(u => u.id === Number(datasheet.approvedBy))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Approved Date</td><td className="border p-2">{datasheet.approvedDate}</td></tr>
              </tbody>
            </table>
          </div>

          {/* 🔹 Equipment Details Preview */}
          <div className="border rounded-md p-4 bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-blue-800">Equipment Details</h3>
            <table className="w-full mt-3 border text-sm">
              <tbody>
                <tr><td className="border p-2 font-medium">Required Qty</td><td className="border p-2">{equipment.requiredQty}</td></tr>
                <tr><td className="border p-2 font-medium">Item Location</td><td className="border p-2">{equipment.itemLocation}</td></tr>
                <tr><td className="border p-2 font-medium">Manufacturer</td><td className="border p-2">{manufacturers.find(m => m.id === Number(equipment.manufacturerId))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Supplier</td><td className="border p-2">{suppliers.find(s => s.id === Number(equipment.supplierId))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Install Pack #</td><td className="border p-2">{equipment.installPackNum}</td></tr>
                <tr><td className="border p-2 font-medium">Model #</td><td className="border p-2">{equipment.modelNum}</td></tr>
                <tr><td className="border p-2 font-medium">Driver</td><td className="border p-2">{equipment.driver}</td></tr>
                <tr><td className="border p-2 font-medium">Location DWG</td><td className="border p-2">{equipment.locationDWG}</td></tr>
                <tr><td className="border p-2 font-medium">PID</td><td className="border p-2">{equipment.pid}</td></tr>
                <tr><td className="border p-2 font-medium">Install DWG</td><td className="border p-2">{equipment.installDWG}</td></tr>
                <tr><td className="border p-2 font-medium">Code/Std</td><td className="border p-2">{equipment.codeStd}</td></tr>
                <tr><td className="border p-2 font-medium">Category</td><td className="border p-2">{categories.find(c => c.id === Number(equipment.categoryId))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Client</td><td className="border p-2">{clients.find(c => c.id === Number(equipment.clientId))?.name || '-'}</td></tr>
                <tr><td className="border p-2 font-medium">Project</td><td className="border p-2">{projects.find(p => p.id === Number(equipment.projectId))?.name || '-'}</td></tr>
              </tbody>
            </table>
          </div>
          {subsheets.map((sheet) => (
            <div key={sheet.id} className="border rounded-md p-4 bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-blue-800">{sheet.name}</h3>
              <table className="w-full mt-3 border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Label</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">UOM</th>
                    <th className="p-2 border">Options</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.templates.map((t, idx) => (
                    <tr key={idx}>
                      <td className="border p-2">{t.name}</td>
                      <td className="border p-2">{t.type}</td>
                      <td className="border p-2">{t.uom}</td>
                      <td className="border p-2">{t.options?.join(', ') ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// src/components/datasheets/SheetHeaderBar.tsx
interface Props {
  selectedLang: string;
  onLangChange: (lang: string) => void;
  unitSystem: "SI" | "USC";
  onUnitToggle: () => void;
}

const SheetHeaderBar: React.FC<Props> = ({ selectedLang, onLangChange, unitSystem, onUnitToggle }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onUnitToggle}
        className={`px-3 py-1 rounded text-sm ${unitSystem === "SI" ? "bg-blue-600 text-white" : "bg-red-600 text-white"}`}
        title="Toggle Unit System"
      >
        {unitSystem}
      </button>
      <select
        value={selectedLang}
        title="Select Language"
        onChange={(e) => onLangChange(e.target.value)}
        className="bg-green-600 text-white px-2 py-1 rounded text-sm"
      >
        <option value="eng">English</option>
        <option value="fr">French</option>
        <option value="de">German</option>
        <option value="ru">Russian</option>
        <option value="zh">Chinese</option>
        <option value="ar">Arabic</option>
      </select>
    </div>
  );
};

export default SheetHeaderBar;

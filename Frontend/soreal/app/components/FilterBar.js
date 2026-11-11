export default function FilterBar({ fields, onFilter }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {fields.map((field) => (
        <div key={field.name} className="flex flex-col">
          <label className="text-sm font-medium mb-1">
            {field.label}
          </label>
          <input
            type={field.type || "text"}
            name={field.name}
            placeholder={field.placeholder || ""}
            value={field.value || ""}
            onChange={(e) => onFilter(field.name, e.target.value)}
            className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      ))}
    </div>
  );
}

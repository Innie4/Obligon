type InputProps = {
  label: string;
  placeholder: string;
  type?: string;
  name: string;
};

export function Input({ label, placeholder, type = "text", name }: InputProps) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold uppercase tracking-[1.1px] text-obligon-text">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-lg border border-obligon-border bg-white px-4 text-sm text-obligon-navy outline-none transition placeholder:text-[#92929c] focus:border-obligon-green focus:ring-2 focus:ring-obligon-green/20"
      />
    </label>
  );
}


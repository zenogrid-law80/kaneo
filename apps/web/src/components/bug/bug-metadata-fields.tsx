import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BugMetadata } from "@/fetchers/bug";
import { bugMetadataFields } from "./bug-metadata";

export default function BugMetadataFields({
  value,
  onChange,
  disabled,
}: {
  value: BugMetadata;
  onChange: (value: Partial<BugMetadata>) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {bugMetadataFields.map(({ key, label, values }) => {
        const items = Object.entries(values).map(([value, label]) => ({
          value,
          label: t(label),
        }));
        return (
          <Field key={key}>
            <FieldLabel>{t(label)}</FieldLabel>
            <Select
              items={items}
              value={value[key] ?? "none"}
              disabled={disabled}
              onValueChange={(id) => {
                if (id)
                  onChange({
                    [key]: id === "none" ? null : id,
                  } as Partial<BugMetadata>);
              }}
            >
              <SelectTrigger aria-label={t(label)}>
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {items.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </Field>
        );
      })}
    </div>
  );
}

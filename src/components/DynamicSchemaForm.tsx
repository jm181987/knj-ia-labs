import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReferenceImageInput } from "@/components/ReferenceImageInput";
import { AudioInput } from "@/components/AudioInput";
import type { WSRequestSchema, WSSchemaProp } from "@/lib/wavespeedCatalog";

type Props = {
  schema: WSRequestSchema;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  fieldLabels?: Record<string, string>;
  fieldDescriptions?: Record<string, string>;
};

function getOrderedKeys(schema: WSRequestSchema): string[] {
  const props = schema.properties || {};
  const ordered = schema["x-order-properties"] || Object.keys(props);
  return ordered.filter((k) => props[k] && !props[k]["x-hidden"]);
}

function isImageField(key: string, prop: WSSchemaProp): boolean {
  if (prop["x-ui-component"] === "uploader") return true;
  const k = key.toLowerCase();
  return /image|img|photo|reference|init|first_frame|last_frame|mask/.test(k);
}

function isAudioField(key: string, prop: WSSchemaProp): boolean {
  const k = key.toLowerCase();
  return /audio|voice|speech/.test(k) && prop.type === "string";
}

function isVideoField(key: string, prop: WSSchemaProp): boolean {
  const k = key.toLowerCase();
  return /(driving|driver|video_url|video$)/.test(k) && prop.type === "string";
}

function FieldRenderer({
  k,
  prop,
  value,
  setValue,
  customLabel,
  customDescription,
}: {
  k: string;
  prop: WSSchemaProp;
  value: unknown;
  setValue: (v: unknown) => void;
  customLabel?: string;
  customDescription?: string;
}) {
  const { t } = useTranslation();
  const labelShort = customLabel || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const descText = customDescription || prop.description;

  // Prompt → textarea
  if (prop.type === "string" && (k === "prompt" || k === "negative_prompt") && !prop.enum) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{labelShort}</Label>
        <Textarea
          rows={k === "prompt" ? 4 : 2}
          value={(value as string) || ""}
          onChange={(e) => setValue(e.target.value)}
          placeholder={descText}
        />
      </div>
    );
  }

  // Imagen
  if (isImageField(k, prop) && prop.type === "string") {
    return <ReferenceImageInput value={(value as string) || ""} onChange={setValue} label={labelShort} />;
  }

  // Audio
  if (isAudioField(k, prop)) {
    return <AudioInput value={(value as string) || ""} onChange={setValue} label={labelShort} bucket="avatar-audio" />;
  }

  // Video (driver / reference)
  if (isVideoField(k, prop)) {
    return (
      <AudioInput
        value={(value as string) || ""}
        onChange={setValue}
        label={labelShort}
        bucket="avatar-videos"
        accept="video/mp4,video/webm,video/quicktime"
        hint={t("catalog.form.videoHint")}
        maxMB={50}
      />
    );
  }

  // Enum → select
  if (prop.enum && prop.enum.length) {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{labelShort}</Label>
        <Select value={String(value ?? prop.default ?? "")} onValueChange={(v) => setValue(v)}>
          <SelectTrigger>
            <SelectValue placeholder={t("catalog.form.selectPlaceholder", { field: labelShort.toLowerCase() })} />
          </SelectTrigger>
          <SelectContent>
            {prop.enum.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
      </div>
    );
  }

  // Slider numérico
  if ((prop.type === "integer" || prop.type === "number") && prop.minimum !== undefined && prop.maximum !== undefined) {
    const num = (value as number) ?? (prop.default as number) ?? prop.minimum;
    const step = prop.type === "integer" ? 1 : (prop.maximum - prop.minimum) / 100;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{labelShort}</Label>
          <span className="text-xs text-muted-foreground tabular-nums">{num}</span>
        </div>
        <Slider
          min={prop.minimum}
          max={prop.maximum}
          step={step}
          value={[num]}
          onValueChange={(arr) => setValue(prop.type === "integer" ? Math.round(arr[0]) : arr[0])}
        />
        {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
      </div>
    );
  }

  // Boolean → switch
  if (prop.type === "boolean") {
    return (
      <div className="flex items-start justify-between gap-3 py-1">
        <div>
          <Label className="text-sm">{labelShort}</Label>
          {descText && <p className="text-xs text-muted-foreground">{descText}</p>}
        </div>
        <Switch checked={!!value} onCheckedChange={setValue} />
      </div>
    );
  }

  // Number / Integer sin rango → input numérico
  if (prop.type === "integer" || prop.type === "number") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{labelShort}</Label>
        <Input
          type="number"
          value={(value as number | string) ?? ""}
          onChange={(e) =>
            setValue(e.target.value === "" ? undefined : prop.type === "integer" ? parseInt(e.target.value, 10) : parseFloat(e.target.value))
          }
          placeholder={prop.default !== undefined ? String(prop.default) : ""}
        />
        {prop.description && <p className="text-xs text-muted-foreground">{prop.description}</p>}
      </div>
    );
  }

  // Array de strings → textarea con líneas
  if (prop.type === "array" && (!prop.items || prop.items.type === "string")) {
    const list = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{labelShort}</Label>
        <Textarea
          rows={3}
          value={list.join("\n")}
          onChange={(e) => setValue(e.target.value.split("\n").filter(Boolean))}
          placeholder={t("catalog.form.oneEntryPerLine")}
        />
      </div>
    );
  }

  // Array de objetos (refs, etc.) → JSON editor simplificado
  if (prop.type === "array") {
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{labelShort} (JSON)</Label>
        <Textarea
          rows={4}
          value={typeof value === "string" ? (value as string) : JSON.stringify(value ?? prop.default ?? [], null, 2)}
          onChange={(e) => {
            try {
              setValue(JSON.parse(e.target.value));
            } catch {
              setValue(e.target.value);
            }
          }}
          className="font-mono text-xs"
        />
        {prop.description && <p className="text-xs text-muted-foreground">{prop.description}</p>}
      </div>
    );
  }

  // String simple → input
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{labelShort}</Label>
      <Input
        value={(value as string) ?? ""}
        onChange={(e) => setValue(e.target.value)}
        placeholder={prop.default !== undefined ? String(prop.default) : prop.description}
      />
      {prop.description && <p className="text-xs text-muted-foreground">{prop.description}</p>}
    </div>
  );
}

export function DynamicSchemaForm({ schema, values, onChange }: Props) {
  const keys = useMemo(() => getOrderedKeys(schema), [schema]);

  // Inicializar defaults una vez
  useEffect(() => {
    const next: Record<string, unknown> = { ...values };
    let changed = false;
    for (const k of keys) {
      const prop = schema.properties?.[k];
      if (prop && next[k] === undefined && prop.default !== undefined) {
        next[k] = prop.default;
        changed = true;
      }
    }
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  return (
    <div className="space-y-4">
      {keys.map((k) => {
        const prop = schema.properties?.[k];
        if (!prop) return null;
        return (
          <FieldRenderer
            key={k}
            k={k}
            prop={prop}
            value={values[k]}
            setValue={(v) => onChange({ ...values, [k]: v })}
          />
        );
      })}
    </div>
  );
}

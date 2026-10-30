import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";

export default function AssigneeFilterPerson({
  name,
  image,
}: {
  name?: string | null;
  image?: string | null;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Avatar className="size-5" aria-hidden="true">
        <AvatarImage src={image ?? ""} alt="" />
        <AvatarFallback className="border border-border/30 text-[10px] font-medium">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

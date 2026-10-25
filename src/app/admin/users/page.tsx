import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/primitives";
import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { UserControls } from "@/components/admin/user-controls";
import { requireAdmin } from "@/server/auth/session";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ADMIN_PAGE_SIZE, one, oneOf, pageOf } from "@/server/admin/params";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = one(sp, "q");
  const role = oneOf(sp, "role", ["USER", "ADMIN"] as const);
  const status = oneOf(sp, "status", ["ACTIVE", "SUSPENDED"] as const);
  const page = pageOf(sp);

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { _count: { select: { orders: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <>
      <PageHeader title="Users" description="Accounts, roles and status. You cannot change your own role or suspend yourself, and the last active admin is protected." />
      <FilterBar action="/admin/users">
        <SearchField value={q} label="Search" placeholder="Name or email" />
        <SelectField name="role" label="Role" value={role} options={[{ value: "USER", label: "User" }, { value: "ADMIN", label: "Admin" }]} />
        <SelectField name="status" label="Status" value={status} options={[{ value: "ACTIVE", label: "Active" }, { value: "SUSPENDED", label: "Suspended" }]} />
      </FilterBar>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title="No users match" description="Adjust the search or filters." action={<Link href="/admin/users" className={buttonVariants({ variant: "secondary" })}>Clear filters</Link>} />
        ) : (
          <Table data-testid="users-table">
            <thead>
              <tr><Th>User</Th><Th>Role</Th><Th>Status</Th><Th className="hidden text-right sm:table-cell">Orders</Th><Th className="hidden sm:table-cell">Joined</Th><Th className="hidden sm:table-cell"><span className="sr-only">Actions</span></Th></tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} data-testid={`user-row-${u.email}`}>
                  <Td>
                    <div className="font-medium whitespace-nowrap">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    <div className="mt-2 sm:hidden"><UserControls userId={u.id} name={u.name} role={u.role} status={u.status} isSelf={u.id === admin.id} /></div>
                  </Td>
                  <Td><StatusBadge status={u.role} /></Td>
                  <Td><StatusBadge status={u.status} /></Td>
                  <Td className="hidden text-right tabular sm:table-cell">{u._count.orders}</Td>
                  <Td className="hidden text-[13px] whitespace-nowrap text-muted-foreground sm:table-cell">{formatDate(u.createdAt)}</Td>
                  <Td className="hidden sm:table-cell"><UserControls userId={u.id} name={u.name} role={u.role} status={u.status} isSelf={u.id === admin.id} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {rows.length > 0 && <Pagination page={page} pages={pages} total={total} pageSize={ADMIN_PAGE_SIZE} basePath="/admin/users" params={{ q, role, status }} />}
    </>
  );
}

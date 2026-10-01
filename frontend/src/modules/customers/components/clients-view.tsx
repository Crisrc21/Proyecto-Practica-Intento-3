"use client";

import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, UserRound } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input, Label, Select } from "@/shared/components/ui/form";
import { Cliente, TipoCliente } from "@/modules/accounts-receivable/types";

export function ClientsView({ initialClientes }: { initialClientes: Cliente[] }) {
  const [clientes, setClientes] = useState(initialClientes);
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [tipo, setTipo] = useState<TipoCliente>("B2B");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nombre || !rut) return;

    setClientes((current) => [
      {
        id: `cli-local-${current.length + 1}`,
        nombre,
        rut,
        tipo
      },
      ...current
    ]);
    setNombre("");
    setRut("");
    setTipo("B2B");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden dark:border-stone-700 dark:bg-stone-950/85">
          <CardHeader className="border-b bg-stone-50/70 dark:border-stone-700 dark:bg-stone-900/50">
            <CardTitle>Crear cliente</CardTitle>
            <CardDescription>Alta manual para B2B y B2C.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre o razón social</Label>
                <Input
                  id="nombre"
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rut">RUT</Label>
                <Input id="rut" value={rut} onChange={(event) => setRut(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo cliente</Label>
                <Select
                  id="tipo"
                  value={tipo}
                  onChange={(event) => setTipo(event.target.value as TipoCliente)}
                >
                  <option value="B2B">B2B</option>
                  <option value="B2C">B2C</option>
                </Select>
              </div>
              <Button type="submit">
                <Plus className="size-4" aria-hidden="true" />
                Agregar cliente
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-3">
        {clientes.map((cliente, index) => {
          const Icon = cliente.tipo === "B2B" ? Building2 : UserRound;

          return (
            <motion.div
              key={cliente.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035 }}
            >
              <Card className="overflow-hidden">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{cliente.nombre}</h2>
                        <Badge tone={cliente.tipo === "B2B" ? "default" : "success"}>
                          {cliente.tipo}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{cliente.rut}</p>
                    </div>
                  </div>
                  <Badge tone="muted">Cliente {cliente.tipo}</Badge>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

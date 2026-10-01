const customers = [
  { id: "cli-001", nombre: "Constructora Andes SpA", rut: "76.245.891-4", tipo: "B2B" },
  { id: "cli-002", nombre: "Inversiones Costa Sur Ltda.", rut: "77.018.334-8", tipo: "B2B" },
  { id: "cli-003", nombre: "Maria Fernanda Rojas", rut: "15.338.452-1", tipo: "B2C" },
  { id: "cli-004", nombre: "Servicios Logisticos Norte S.A.", rut: "96.831.440-2", tipo: "B2B" }
];

export function createLocalCustomersRepository() {
  return {
    async list() {
      return customers;
    }
  };
}

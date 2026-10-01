export function createCustomerService(repository) {
  return {
    listCustomers() {
      return repository.list();
    }
  };
}

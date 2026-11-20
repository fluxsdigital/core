import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActionForm, Field } from "../app/conta/forms";

test("mantém controles desabilitados durante o envio e confirma o sucesso", async () => {
  let resolve: () => void = () => undefined;
  const action = jest.fn(
    () =>
      new Promise<void>((finish) => {
        resolve = finish;
      }),
  );
  render(
    <ActionForm action={action} label="Salvar" done="Dados salvos">
      <Field name="name" label="Nome" />
    </ActionForm>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Flux" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(action).toHaveBeenCalledWith({ name: "Flux" }, expect.any(FormData));
  expect(screen.getByRole("textbox", { name: "Nome" })).toBeDisabled();
  resolve();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Dados salvos"));
  expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("");
});

test("exibe erro de validação sem apagar o que foi preenchido", async () => {
  render(
    <ActionForm
      action={jest.fn().mockRejectedValue(new Error("Nome já cadastrado"))}
      label="Salvar"
    >
      <Field name="name" label="Nome" />
    </ActionForm>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Flux" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Nome já cadastrado");
  expect(screen.getByRole("textbox", { name: "Nome" })).toHaveValue("Flux");
});

import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import nodemailer from "nodemailer";
import { appOrigin } from "./auth.config";

@Injectable()
export class MailService {
  async sendReset(email: string, token: string) {
    const configuration = process.env.SMTP_URL;
    const from = process.env.MAIL_FROM;
    if (!configuration || !from)
      throw new ServiceUnavailableException("Recuperação de senha indisponível.");
    const url = new URL("/redefinir-senha", appOrigin());
    url.hash = token;
    const transport = nodemailer.createTransport(configuration, {
      from,
    });
    await transport.sendMail({
      to: email,
      subject: "Redefinição de senha do Flux Core",
      text: `Use este endereço para redefinir sua senha em até 30 minutos.\n\n${url.href}`,
    });
  }
}

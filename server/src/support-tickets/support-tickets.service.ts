import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket, TicketStatus } from './entities/support-ticket.entity';
import {
  CreateSupportTicketDto,
  ReplySupportTicketDto,
} from './dto/create-support-ticket.dto';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupportTicketsService {
  private readonly logger = new Logger(SupportTicketsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    private readonly configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USER', ''),
        pass: this.configService.get<string>('EMAIL_PASSWORD', ''),
      },
    });
  }

  async create(
    createSupportTicketDto: CreateSupportTicketDto,
  ): Promise<SupportTicket> {
    const ticket = this.ticketRepository.create(createSupportTicketDto);
    return this.ticketRepository.save(ticket);
  }

  async findAll(): Promise<SupportTicket[]> {
    return this.ticketRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async reply(
    id: string,
    replyDto: ReplySupportTicketDto,
  ): Promise<SupportTicket> {
    const ticket = await this.findOne(id);

    // Save reply to DB
    ticket.adminReply = replyDto.replyMessage;
    ticket.status = TicketStatus.CLOSED;
    const updatedTicket = await this.ticketRepository.save(ticket);

    // Send email to user
    try {
      await this.transporter.sendMail({
        from: `"GridGO Support" <${this.configService.get<string>('EMAIL_USER', '')}>`,
        to: ticket.email,
        subject: `Re: ${ticket.subject} (Ticket #${ticket.id.substring(0, 8)})`,
        text: `Dear ${ticket.name},\n\nRegarding your ticket "${ticket.subject}":\n\n${ticket.message}\n\n---\n\nAdmin Reply:\n${replyDto.replyMessage}\n\nBest regards,\nGrid Support Team`,
        html: `
          <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #050505; padding: 40px 20px; color: #ffffff;">
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #111111; border-radius: 16px; overflow: hidden; border: 1px solid #222222;">
              <!-- Header with Logo -->
              <tr>
                <td style="padding: 30px; text-align: center; border-bottom: 1px solid #222222;">
                  <table border="0" cellpadding="0" cellspacing="3" style="display: inline-table; vertical-align: middle;">
                    <tr>
                      <td style="width:8px; height:8px; background-color:#ffffff; border-radius:50%;"></td>
                      <td style="width:8px; height:8px; background-color:#ffffff; border-radius:50%;"></td>
                      <td style="width:8px; height:8px; background-color:#FFDE58; border-radius:50%;"></td>
                    </tr>
                    <tr>
                      <td style="width:8px; height:8px; background-color:#ffffff; border-radius:50%;"></td>
                      <td style="width:8px; height:8px; background-color:#ffffff; border-radius:50%;"></td>
                      <td style="width:8px; height:8px; background-color:#6B7280; border-radius:50%;"></td>
                    </tr>
                    <tr>
                      <td style="width:8px; height:8px; background-color:#ffffff; border-radius:50%;"></td>
                      <td style="width:8px; height:8px; background-color:#ffffff; border-radius:50%;"></td>
                      <td style="width:8px; height:8px; background-color:#6B7280; border-radius:50%;"></td>
                    </tr>
                  </table>
                  <span style="font-size: 28px; font-weight: 800; color: #ffffff; vertical-align: middle; margin-left: 12px; letter-spacing: 3px;">GRIDGO</span>
                </td>
              </tr>
              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">Support Reply</h2>
                  <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #E5E7EB;">
                    Hi <strong>${ticket.name}</strong>,
                  </p>
                  <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #9CA3AF;">
                    Thank you for reaching out to us. We have received your inquiry regarding <strong>"${ticket.subject}"</strong>.
                  </p>
                  
                  <!-- Original Message -->
                  <div style="background-color: #1A1A1A; border-left: 4px solid #333333; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 1px;">Your Message</p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #D1D5DB; font-style: italic;">
                      ${ticket.message.replace(/\n/g, '<br/>')}
                    </p>
                  </div>

                  <!-- Admin Reply -->
                  <div style="background-color: rgba(255, 222, 88, 0.05); border: 1px solid rgba(255, 222, 88, 0.2); padding: 24px; border-radius: 12px; margin-bottom: 30px;">
                    <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #FFDE58; text-transform: uppercase; letter-spacing: 1px;">Admin Response</p>
                    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #ffffff;">
                      ${replyDto.replyMessage.replace(/\n/g, '<br/>')}
                    </p>
                  </div>

                  <p style="margin: 0; font-size: 15px; line-height: 1.5; color: #E5E7EB;">
                    Best regards,<br/>
                    <strong style="color: #ffffff;">The GRIDGO Team</strong>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 30px; text-align: center; border-top: 1px solid #222222; background-color: #0A0A0A;">
                  <p style="margin: 0; font-size: 12px; color: #6B7280;">
                    &copy; ${new Date().getFullYear()} GRIDGO. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        `,
      });
      this.logger.log(
        `Reply email sent to ${ticket.email} for ticket ${ticket.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send reply email to ${ticket.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return updatedTicket;
  }

  async remove(id: string): Promise<void> {
    const ticket = await this.findOne(id);
    await this.ticketRepository.remove(ticket);
  }
}

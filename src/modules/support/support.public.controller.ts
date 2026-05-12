import { Request, Response, NextFunction } from "express";
import { SupportService } from "./support.service";
import { ApiResponse } from "@shared/utils/api-response";
import { HTTP_STATUS } from "@shared/constant/http-codes";
import { MessageSenderRole } from "./interfaces/support.interface";
import { CreateTicketInput, ReplyTicketInput } from "./dtos/support.dto";

/**
 * PUBLIC SUPPORT CONTROLLER (Customer Facing)
 * @description Exposes secure, read-write operations for authenticated users
 * to manage their own support tickets. Inherently enforces IDOR protection.
 */
export class SupportPublicController {
  /**
   * @route   POST /api/v1/support/tickets
   * @desc    Create a new support ticket
   * @access  Private (Requires valid JWT)
   */
  public static async createTicket(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Guaranteed by the auth.middleware restrictTo("USER")
      const userId = String(req.user!._id);
      const payload = req.body as CreateTicketInput;

      // Cloudinary File Extraction (Array of up to 3 images)
      const attachmentUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file: Express.Multer.File) => {
          // multer-storage-cloudinary attaches the secure remote URL to the 'path' property
          if (file.path) attachmentUrls.push(file.path);
        });
      }

      const ticket = await SupportService.createTicket(
        userId,
        payload,
        attachmentUrls,
      );

      // The function implicitly returns void while safely closing the HTTP connection.
      new ApiResponse(
        res,
        HTTP_STATUS.CREATED,
        "Support ticket created successfully. Our team will respond shortly.",
        { ticket },
      ).send();
    } catch (error) {
      next(error); // Delegate to global error.middleware
    }
  }

  /**
   * @route   POST /api/v1/support/tickets/:ticketId/reply
   * @desc    Customer replies to an existing ticket
   * @access  Private (Requires valid JWT)
   */
  public static async replyToTicket(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = String(req.user!._id);
      const ticketId = String(req.params.ticketId);
      const payload = req.body as ReplyTicketInput;

      const attachmentUrls: string[] = [];
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file: Express.Multer.File) => {
          if (file.path) attachmentUrls.push(file.path);
        });
      }

      const ticket = await SupportService.replyToTicket(
        ticketId,
        userId,
        MessageSenderRole.USER, // SECURITY: Hardcoded so customers cannot spoof admin replies
        payload,
        attachmentUrls,
      );

      new ApiResponse(res, HTTP_STATUS.OK, "Reply sent successfully.", {
        ticket,
      }).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/v1/support/tickets/me
   * @desc    Fetch the logged-in user's ticket history
   * @access  Private (Requires valid JWT)
   */
  public static async getMyTickets(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const userId = String(req.user!._id);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // SECURITY: Mandatory IDOR firewall inside the query using $eq (CWE-943)
      const query = { user: { $eq: userId } };

      const { tickets, meta } = await SupportService.fetchTickets(
        query,
        limit,
        skip,
      );

      new ApiResponse(
        res,
        HTTP_STATUS.OK,
        "Support tickets retrieved successfully.",
        { tickets, meta },
      ).send();
    } catch (error) {
      next(error);
    }
  }
}

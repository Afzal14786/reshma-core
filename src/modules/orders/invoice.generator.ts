import PDFDocument from "pdfkit";
import { IOrder } from "./interfaces/order.interface";

/**
 * Enterprise PDF Invoice Generator
 * * ARCHITECTURE NOTE:
 * Generates a purely in-memory PDF Buffer. We strictly avoid `fs.writeFile` to prevent
 * storage bloat and synchronous I/O Event Loop blocking during high-traffic checkouts.
 */
export const generateInvoiceBuffer = (order: IOrder): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers: Buffer[] = [];

      // Pipe stream into buffer array
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // COMPANY HEADER
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("RESHMA BANGLES", { align: "left" });
      doc
        .fontSize(10)
        .font("Helvetica")
        .text("123 Fashion Street, Sector 17", { align: "left" })
        .text("Navi Mumbai, Maharashtra 400703", { align: "left" })
        .text("GSTIN: 27AAAAA0000A1Z5", { align: "left" })
        .moveDown();

      // INVOICE META DATA
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("TAX INVOICE", { align: "right" });

      doc.moveTo(50, 130).lineTo(545, 130).lineWidth(1).stroke();
      doc.moveDown(2);

      const invoiceDate = new Date(order.createdAt).toLocaleDateString("en-IN");

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Order Number: ", 50, 150, { continued: true })
        .font("Helvetica")
        .text(order.orderNumber);

      doc
        .font("Helvetica-Bold")
        .text("Invoice Date: ", 50, 165, { continued: true })
        .font("Helvetica")
        .text(invoiceDate);

      doc
        .font("Helvetica-Bold")
        .text("Payment Method: ", 50, 180, { continued: true })
        .font("Helvetica")
        .text(order.paymentMethod);

      // BILLING / SHIPPING ADDRESS
      doc.font("Helvetica-Bold").text("Billed To / Shipped To:", 350, 150);
      doc
        .font("Helvetica")
        .text(order.shippingAddress.fullName, 350, 165)
        .text(order.shippingAddress.streetAddress, 350, 180)
        .text(
          `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}`,
          350,
          195,
        )
        .text(`Phone: ${order.shippingAddress.phone}`, 350, 210);

      doc.moveTo(50, 240).lineTo(545, 240).stroke();
      doc.moveDown(3);

      // ITEMS TABLE
      let tableTop = 260;
      doc.font("Helvetica-Bold");
      doc.text("Item Description", 50, tableTop);
      doc.text("Qty", 300, tableTop, { width: 50, align: "center" });
      doc.text("Unit Price", 380, tableTop, { width: 70, align: "right" });
      doc.text("Total", 470, tableTop, { width: 75, align: "right" });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      doc.font("Helvetica");
      let positionY = tableTop + 25;

      for (const item of order.items) {
        const itemTotal = item.quantity * item.priceAtPurchase;
        const safeName =
          item.name.length > 40
            ? item.name.substring(0, 37) + "..."
            : item.name;

        doc.text(safeName, 50, positionY, { width: 240 });
        doc.text(item.quantity.toString(), 300, positionY, {
          width: 50,
          align: "center",
        });
        doc.text(`Rs. ${item.priceAtPurchase.toFixed(2)}`, 380, positionY, {
          width: 70,
          align: "right",
        });
        doc.text(`Rs. ${itemTotal.toFixed(2)}`, 470, positionY, {
          width: 75,
          align: "right",
        });

        positionY += 20;
      }

      doc
        .moveTo(50, positionY + 10)
        .lineTo(545, positionY + 10)
        .stroke();

      // FINANCIAL TOTALS
      const totalsTop = positionY + 25;
      doc.font("Helvetica");

      doc.text("Subtotal:", 380, totalsTop, { width: 70, align: "right" });
      doc.text(`Rs. ${order.pricing.subTotal.toFixed(2)}`, 470, totalsTop, {
        width: 75,
        align: "right",
      });

      doc.text("Shipping:", 380, totalsTop + 15, { width: 70, align: "right" });
      doc.text(
        `Rs. ${order.pricing.shippingCost.toFixed(2)}`,
        470,
        totalsTop + 15,
        { width: 75, align: "right" },
      );

      doc.text("Estimated GST:", 380, totalsTop + 30, {
        width: 70,
        align: "right",
      });
      doc.text(
        `Rs. ${order.pricing.taxAmount.toFixed(2)}`,
        470,
        totalsTop + 30,
        { width: 75, align: "right" },
      );

      doc
        .moveTo(380, totalsTop + 50)
        .lineTo(545, totalsTop + 50)
        .stroke();

      doc.font("Helvetica-Bold");
      doc.text("GRAND TOTAL:", 350, totalsTop + 60, {
        width: 100,
        align: "right",
      });
      doc.text(
        `Rs. ${order.pricing.totalAmount.toFixed(2)}`,
        470,
        totalsTop + 60,
        { width: 75, align: "right" },
      );

      // FOOTER
      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .text("Thank you for shopping with Reshma Bangles!", 50, 700, {
          align: "center",
          width: 500,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

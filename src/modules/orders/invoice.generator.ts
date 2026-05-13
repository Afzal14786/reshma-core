import PDFDocument from "pdfkit";
import { IOrder } from "./interfaces/order.interface";

/**
 * Enterprise PDF Invoice Generator (GST Compliant)
 * * ARCHITECTURE NOTE:
 * Generates a purely in-memory PDF Buffer. We strictly avoid `fs.writeFile` to prevent
 * storage bloat and synchronous I/O Event Loop blocking during high-traffic checkouts.
 * * * LOGO HANDLING:
 * PDFKit requires images to be local or converted to a Buffer. We fetch the Cloudinary
 * logo asynchronously before starting the PDF stream.
 */
export const generateInvoiceBuffer = async (order: IOrder): Promise<Buffer> => {
  // 1. Asynchronously fetch the brand logo into a binary Buffer
  let logoBuffer: Buffer | null = null;
  const logoUrl =
    "https://res.cloudinary.com/dl9bfojiu/image/upload/reshma_boutique_logo_hyvmk9.png";

  try {
    const response = await fetch(logoUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      logoBuffer = Buffer.from(arrayBuffer);
    }
  } catch (error) {
    // Graceful fallback: If Cloudinary is down, we just print the text header.
  }

  // 2. Generate the PDF
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const buffers: Buffer[] = [];

      // Pipe stream into buffer array
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const startX = 50;
      let textStartX = startX;

      // Render Logo if successfully fetched
      if (logoBuffer) {
        doc.image(logoBuffer, startX, 45, { width: 80 });
        textStartX = 140; // Shift company text to the right of the logo
      }

      // COMPANY HEADER (Strict GST Details)
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("Reshma Bangles & Boutique", textStartX, 45, { align: "left" });

      doc
        .fontSize(9)
        .font("Helvetica")
        .text("23 S.D.B Street, Paikpara", textStartX, 65, { align: "left" })
        .text("Bhadreshwar - 712125, Hooghly, West Bengal", textStartX, 77, {
          align: "left",
        })
        .font("Helvetica-Bold")
        .text("GSTIN: 19CWZPA5790C1Z1", textStartX, 92, { align: "left" })
        .font("Helvetica")
        .text(
          "Email: mdafal14777@gmail.com | Phone: +91-9137116340, +91-9836522456",
          textStartX,
          107,
          { align: "left" },
        );

      // INVOICE META DATA (Right Aligned)
      doc
        .fontSize(16)
        .font("Helvetica-Bold")
        .text("TAX INVOICE", 50, 45, { align: "right", width: 495 });

      doc.moveTo(50, 135).lineTo(545, 135).lineWidth(1).stroke();
      doc.moveDown(2);

      const invoiceDate = new Date(order.createdAt).toLocaleDateString("en-IN");

      // ORDER DETAILS
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
      doc.font("Helvetica-Bold").text("Billed To / Shipped To:", 300, 150);
      doc
        .font("Helvetica")
        .text(order.shippingAddress.fullName, 300, 165)
        .text(order.shippingAddress.streetAddress, 300, 180)
        .text(
          `${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}`,
          300,
          195,
        )
        .text(`Phone: ${order.shippingAddress.phone}`, 300, 210);

      doc.moveTo(50, 230).lineTo(545, 230).stroke();
      doc.moveDown(2);

      // LEGAL GST ITEMS TABLE
      let tableTop = 250;
      doc.font("Helvetica-Bold").fontSize(9);

      // Dynamic Column Widths for A4 Format
      doc.text("Item Description", 50, tableTop);
      doc.text("HSN", 210, tableTop);
      doc.text("Qty", 255, tableTop);
      doc.text("Taxable", 280, tableTop, { width: 50, align: "right" });
      doc.text("CGST", 335, tableTop, { width: 45, align: "right" });
      doc.text("SGST", 385, tableTop, { width: 45, align: "right" });
      doc.text("IGST", 435, tableTop, { width: 45, align: "right" });
      doc.text("Total", 485, tableTop, { width: 60, align: "right" });

      doc
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      doc.font("Helvetica").fontSize(9);
      let positionY = tableTop + 25;

      for (const item of order.items) {
        // Line Item Total = Taxable Value + All Exact Tax Splits
        const itemTotal = item.taxableValue + item.cgst + item.sgst + item.igst;
        const safeName =
          item.name.length > 25
            ? item.name.substring(0, 22) + "..."
            : item.name;

        doc.text(safeName, 50, positionY, { width: 150 });
        doc.text(item.hsnCode, 210, positionY);
        doc.text(item.quantity.toString(), 255, positionY);

        doc.text(item.taxableValue.toFixed(2), 280, positionY, {
          width: 50,
          align: "right",
        });
        doc.text(item.cgst.toFixed(2), 335, positionY, {
          width: 45,
          align: "right",
        });
        doc.text(item.sgst.toFixed(2), 385, positionY, {
          width: 45,
          align: "right",
        });
        doc.text(item.igst.toFixed(2), 435, positionY, {
          width: 45,
          align: "right",
        });
        doc.text(itemTotal.toFixed(2), 485, positionY, {
          width: 60,
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
      doc.font("Helvetica").fontSize(10);
      let offset = 0;

      doc.text("Subtotal (Gross):", 345, totalsTop + offset, {
        width: 100,
        align: "right",
      });
      doc.text(
        `Rs. ${order.pricing.subTotal.toFixed(2)}`,
        455,
        totalsTop + offset,
        { width: 90, align: "right" },
      );
      offset += 15;

      if (order.pricing.discountAmount > 0) {
        doc.text("Discount Applied:", 345, totalsTop + offset, {
          width: 100,
          align: "right",
        });
        doc.fillColor("green");
        doc.text(
          `- Rs. ${order.pricing.discountAmount.toFixed(2)}`,
          455,
          totalsTop + offset,
          { width: 90, align: "right" },
        );
        doc.fillColor("black");
        offset += 15;
      }

      doc.text("Shipping (Logistics):", 345, totalsTop + offset, {
        width: 100,
        align: "right",
      });
      doc.text(
        `Rs. ${order.pricing.shippingCost.toFixed(2)}`,
        455,
        totalsTop + offset,
        { width: 90, align: "right" },
      );
      offset += 15;

      // Granular State Tax Rendering
      if (order.pricing.totalCgst > 0) {
        doc.text("Total CGST:", 345, totalsTop + offset, {
          width: 100,
          align: "right",
        });
        doc.text(
          `Rs. ${order.pricing.totalCgst.toFixed(2)}`,
          455,
          totalsTop + offset,
          { width: 90, align: "right" },
        );
        offset += 15;

        doc.text("Total SGST:", 345, totalsTop + offset, {
          width: 100,
          align: "right",
        });
        doc.text(
          `Rs. ${order.pricing.totalSgst.toFixed(2)}`,
          455,
          totalsTop + offset,
          { width: 90, align: "right" },
        );
        offset += 15;
      }

      if (order.pricing.totalIgst > 0) {
        doc.text("Total IGST:", 345, totalsTop + offset, {
          width: 100,
          align: "right",
        });
        doc.text(
          `Rs. ${order.pricing.totalIgst.toFixed(2)}`,
          455,
          totalsTop + offset,
          { width: 90, align: "right" },
        );
        offset += 15;
      }

      doc
        .moveTo(350, totalsTop + offset + 5)
        .lineTo(545, totalsTop + offset + 5)
        .stroke();

      doc.font("Helvetica-Bold");
      doc.text("GRAND TOTAL:", 345, totalsTop + offset + 15, {
        width: 100,
        align: "right",
      });
      doc.text(
        `Rs. ${order.pricing.totalAmount.toFixed(2)}`,
        455,
        totalsTop + offset + 15,
        { width: 90, align: "right" },
      );

      // LEGAL FOOTER: Terms & Authorized Signatory

      const pageHeight = doc.page.height;
      const termsY = pageHeight - 160;

      doc
        .moveTo(50, termsY - 10)
        .lineTo(545, termsY - 10)
        .lineWidth(1)
        .stroke();

      // T&C Section
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("Terms & Conditions:", 50, termsY);
      doc
        .font("Helvetica")
        .fontSize(8)
        .text(
          "1. All disputes are subject to Hooghly Jurisdiction only.",
          50,
          termsY + 15,
        )
        .text(
          "2. Returns are accepted within 7 days of delivery as per company policy.",
          50,
          termsY + 27,
        )
        .text(
          "3. Goods once sold will not be taken back without valid return authorization.",
          50,
          termsY + 39,
        );

      // Authorized Signatory Box
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("For Reshma Bangles & Boutique", 350, termsY, {
          align: "right",
          width: 195,
        });
      doc
        .font("Helvetica")
        .fontSize(9)
        .text("Authorized Signatory", 350, termsY + 50, {
          align: "right",
          width: 195,
        });

      // Final automated stamp
      doc
        .fontSize(8)
        .font("Helvetica-Oblique")
        .text(
          "This is a computer-generated invoice and does not require a physical signature.",
          50,
          pageHeight - 50,
          { align: "center", width: 495 },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

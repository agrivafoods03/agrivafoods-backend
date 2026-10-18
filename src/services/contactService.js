import { Contact } from '../models/Contact.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';
import { emailService } from './emailService.js';
import { logger } from '../utils/logger.js';

export class ContactService {
  static async submitContact(data) {
    const { name, email, phone, subject, message } = data;
    if (!name || !email || !message) {
      throw new ApiError(400, 'Name, email, and message are required.');
    }

    const payload = {
      name,
      email: email.toLowerCase().trim(),
      phone: phone || '',
      subject: subject || 'General Inquiry',
      message,
      status: 'new'
    };

    let inquiry = null;
    if (checkDbConnection()) {
      inquiry = await Contact.create(payload);
    } else {
      inquiry = {
        _id: `cont_${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString()
      };
      memoryStore.contacts.unshift(inquiry);
    }

    // Trigger admin notification asynchronously (non-blocking)
    emailService.sendContactInquiryNotification(inquiry).catch(err => {
      logger.error(`[ContactService] Failed to send contact notification: ${err.message}`);
    });

    return inquiry;
  }

  static async getAllContacts({ status, page = 1, limit = 20 }) {
    if (checkDbConnection()) {
      const query = status ? { status } : {};
      const skip = (page - 1) * limit;
      const total = await Contact.countDocuments(query);
      const contacts = await Contact.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

      return { contacts, total, page: Number(page), pages: Math.ceil(total / limit) };
    } else {
      let list = [...memoryStore.contacts];
      if (status) list = list.filter(c => c.status === status);
      const total = list.length;
      const skip = (page - 1) * limit;
      const paginated = list.slice(skip, skip + Number(limit));

      return { contacts: paginated, total, page: Number(page), pages: Math.ceil(total / limit) };
    }
  }

  static async updateContactStatus(id, status) {
    if (checkDbConnection()) {
      const contact = await Contact.findByIdAndUpdate(id, { status }, { new: true });
      if (!contact) throw new ApiError(404, 'Contact inquiry not found.');
      return contact;
    } else {
      const contact = memoryStore.contacts.find(c => c._id === id || c.id === id);
      if (!contact) throw new ApiError(404, 'Contact inquiry not found.');
      contact.status = status;
      return contact;
    }
  }

  static async deleteContact(id) {
    if (checkDbConnection()) {
      const contact = await Contact.findByIdAndDelete(id);
      if (!contact) throw new ApiError(404, 'Contact inquiry not found.');
      return { success: true, message: 'Inquiry deleted successfully' };
    } else {
      const idx = memoryStore.contacts.findIndex(c => c._id === id || c.id === id);
      if (idx === -1) throw new ApiError(404, 'Contact inquiry not found.');
      memoryStore.contacts.splice(idx, 1);
      return { success: true, message: 'Inquiry deleted successfully' };
    }
  }
}

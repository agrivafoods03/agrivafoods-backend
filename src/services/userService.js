import { User } from '../models/User.js';
import { checkDbConnection } from '../config/db.js';
import { memoryStore } from '../utils/memoryStore.js';
import { ApiError } from '../utils/ApiError.js';

export class UserService {
  static async getProfile(userId) {
    if (checkDbConnection()) {
      const user = await User.findById(userId).select('-password');
      if (!user) throw new ApiError(404, 'User not found.');
      return user;
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) throw new ApiError(404, 'User not found.');
      const { password: _, ...cleanUser } = user; // eslint-disable-line no-unused-vars
      return cleanUser;
    }
  }

  static async updateProfile(userId, updateData) {
    const allowedUpdates = ['name', 'phone'];
    const filtered = {};
    for (const key of allowedUpdates) {
      if (updateData[key] !== undefined) filtered[key] = updateData[key];
    }

    if (checkDbConnection()) {
      const user = await User.findByIdAndUpdate(userId, filtered, { new: true, runValidators: true }).select('-password');
      if (!user) throw new ApiError(404, 'User not found.');
      return user;
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) throw new ApiError(404, 'User not found.');
      Object.assign(user, filtered);
      const { password: _, ...cleanUser } = user; // eslint-disable-line no-unused-vars
      return cleanUser;
    }
  }

  static async addAddress(userId, addressData) {
    const { street, city, state, pincode, isDefault } = addressData;
    if (!street || !city || !state || !pincode) {
      throw new ApiError(400, 'Street, city, state, and pincode are required.');
    }

    if (checkDbConnection()) {
      const user = await User.findById(userId);
      if (!user) throw new ApiError(404, 'User not found.');

      if (isDefault) {
        user.addresses.forEach(a => { a.isDefault = false; });
      }

      user.addresses.push({ street, city, state, pincode, isDefault: isDefault || user.addresses.length === 0 });
      await user.save();
      return user.addresses;
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) throw new ApiError(404, 'User not found.');

      if (isDefault) {
        user.addresses.forEach(a => { a.isDefault = false; });
      }

      const newAddress = {
        _id: `addr_${Date.now()}`,
        street,
        city,
        state,
        pincode,
        isDefault: Boolean(isDefault) || user.addresses.length === 0
      };
      user.addresses.push(newAddress);
      return user.addresses;
    }
  }

  static async deleteAddress(userId, addressId) {
    if (checkDbConnection()) {
      const user = await User.findById(userId);
      if (!user) throw new ApiError(404, 'User not found.');

      user.addresses = user.addresses.filter(a => a._id.toString() !== addressId);
      await user.save();
      return user.addresses;
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) throw new ApiError(404, 'User not found.');

      user.addresses = user.addresses.filter(a => a._id !== addressId);
      return user.addresses;
    }
  }

  static async getWishlist(userId) {
    if (checkDbConnection()) {
      const user = await User.findById(userId).populate('wishlist');
      if (!user) throw new ApiError(404, 'User not found.');
      return user.wishlist;
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) throw new ApiError(404, 'User not found.');
      return user.wishlist || [];
    }
  }

  static async toggleWishlist(userId, productSlug) {
    if (checkDbConnection()) {
      const user = await User.findById(userId);
      if (!user) throw new ApiError(404, 'User not found.');

      const index = user.wishlist.indexOf(productSlug);
      let inWishlist = false;
      if (index > -1) {
        user.wishlist.splice(index, 1);
      } else {
        user.wishlist.push(productSlug);
        inWishlist = true;
      }
      await user.save();
      return { wishlist: user.wishlist, inWishlist };
    } else {
      const user = memoryStore.users.find(u => u._id === userId || u.id === userId);
      if (!user) throw new ApiError(404, 'User not found.');

      if (!user.wishlist) user.wishlist = [];
      const index = user.wishlist.indexOf(productSlug);
      let inWishlist = false;
      if (index > -1) {
        user.wishlist.splice(index, 1);
      } else {
        user.wishlist.push(productSlug);
        inWishlist = true;
      }
      return { wishlist: user.wishlist, inWishlist };
    }
  }

  static async getAllUsers({ page = 1, limit = 20, search }) {
    if (checkDbConnection()) {
      const query = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      const skip = (page - 1) * limit;
      const total = await User.countDocuments(query);
      const users = await User.find(query).select('-password').skip(skip).limit(limit).sort({ createdAt: -1 });

      return { users, total, page: Number(page), pages: Math.ceil(total / limit) };
    } else {
      let users = [...memoryStore.users];
      if (search) {
        const lower = search.toLowerCase();
        users = users.filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
      }
      const total = users.length;
      const skip = (page - 1) * limit;
      const paginated = users.slice(skip, skip + Number(limit)).map(u => {
        const { password: _, ...clean } = u; // eslint-disable-line no-unused-vars
        return clean;
      });

      return { users: paginated, total, page: Number(page), pages: Math.ceil(total / limit) };
    }
  }
}

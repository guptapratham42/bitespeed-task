const express = require('express');
const { Op } = require('sequelize');
const Contact = require('./models/contact');
const sequelize = require('./config/database'); // Import your database configuration


sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced');
}).catch(err => {
  console.error('Unable to sync database:', err);
});

const app = express();
app.use(express.json());

app.post('/identify', async (req, res) => {
    const { email, phoneNumber } = req.body;
  
    if (!email && !phoneNumber) {
      return res.status(400).json({ error: "Either email or phoneNumber must be provided" });
    }
  
    try {
      await sequelize.sync();
  
      // Find existing contacts with the same email or phone number
      const existingContacts = await Contact.findAll({
        where: {
          [Op.or]: [
            { email: email || null },
            { phoneNumber: phoneNumber || null }
          ]
        }
      });
  
      if (existingContacts.length === 0) {
        // No existing contacts, create a new primary contact
        const newContact = await Contact.create({ email, phoneNumber });
        return res.status(200).json({
          contact: {
            primaryContactId: newContact.id,
            emails: [newContact.email],
            phoneNumbers: [newContact.phoneNumber],
            secondaryContactIds: []
          }
        });
      } else {
        // Consolidate contact information
        let primaryContact = existingContacts[0];
        for (const contact of existingContacts) {
          if (contact.linkPrecedence === 'primary' && contact.createdAt < primaryContact.createdAt) {
            primaryContact = contact;
          }
        }
  
        // Ensure all other contacts are marked as secondary and linked to the primary
        const secondaryContacts = existingContacts.filter(contact => contact.id !== primaryContact.id);
        for (const contact of secondaryContacts) {
          if (contact.linkPrecedence !== 'secondary') {
            contact.linkPrecedence = 'secondary';
            contact.linkedId = primaryContact.id;
            await contact.save();
          }
        }
  
        // Add new information as a secondary contact if not already present
        const newEmailOrPhone = (email && !existingContacts.some(contact => contact.email === email)) ||
                                (phoneNumber && !existingContacts.some(contact => contact.phoneNumber === phoneNumber));
        if (newEmailOrPhone) {
          const newSecondaryContact = await Contact.create({
            email,
            phoneNumber,
            linkedId: primaryContact.id,
            linkPrecedence: 'secondary'
          });
          secondaryContacts.push(newSecondaryContact);
        }
  
        // Re-link all secondary contacts if primary contact changes
        const reLinkSecondaryContacts = async (oldPrimaryId, newPrimaryId) => {
          const contactsToReLink = await Contact.findAll({
            where: {
              linkedId: oldPrimaryId
            }
          });
          for (const contact of contactsToReLink) {
            contact.linkedId = newPrimaryId;
            await contact.save();
          }
        };
  
        // If a secondary contact with the same email or phoneNumber has an older primary, re-link
        for (const contact of secondaryContacts) {
          if (contact.linkPrecedence === 'primary' && contact.createdAt < primaryContact.createdAt) {
            const oldPrimaryContact = primaryContact;
            primaryContact = contact;
            oldPrimaryContact.linkPrecedence = 'secondary';
            oldPrimaryContact.linkedId = primaryContact.id;
            await oldPrimaryContact.save();
            await reLinkSecondaryContacts(oldPrimaryContact.id, primaryContact.id);
          }
        }
  
        // Prepare the response
        const emails = [...new Set([primaryContact.email, ...secondaryContacts.map(contact => contact.email)].filter(e => e))];
        const phoneNumbers = [...new Set([primaryContact.phoneNumber, ...secondaryContacts.map(contact => contact.phoneNumber)].filter(p => p))];
        const secondaryContactIds = secondaryContacts.map(contact => contact.id);
  
        return res.status(200).json({
          contact: {
            primaryContactId: primaryContact.id,
            emails,
            phoneNumbers,
            secondaryContactIds
          }
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
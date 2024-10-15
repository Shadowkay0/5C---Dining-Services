import React, { useState, useEffect, useRef } from "react";
import { auth } from "../../firebaseConfig";
import {
  fetchData,
  postData,
  updateData,
  deleteData,
} from "../../API/MealCredits"; // Import the API methods

interface Account {
  name: string;
  balance: number;
  default: boolean;
}

const BalanceTab: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [fromAccount, setFromAccount] = useState<string>("");
  const [toAccount, setToAccount] = useState<string>("");

  // Fetch current user's accounts from the API
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUserEmail(currentUser.email);

        try {
          const userId = currentUser.email;
          const fetchedAccounts = await fetchData(
            `MealCredits/Retrieve/${userId}`
          );

          if (fetchedAccounts && fetchedAccounts.accounts) {
            setAccounts(
              fetchedAccounts.accounts.map((account: any) => ({
                name: account.accountName,
                balance: account.balance,
                default: account.isDefault || false,
              }))
            );
          } else {
            setAccounts([]);
          }
        } catch (error) {
          console.error("Error fetching accounts:", error);
          setAccounts([]);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Function to handle adding a new account
  const handleAddAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newAccountName.trim() && userEmail) {
      try {
        await postData(`MealCredits/Create/${userEmail}`, {
          accountName: newAccountName,
        });

        const updatedAccounts = await fetchData(
          `MealCredits/Retrieve/${userEmail}`
        );

        if (updatedAccounts && updatedAccounts.accounts) {
          setAccounts(
            updatedAccounts.accounts.map((account: any) => ({
              name: account.accountName,
              balance: account.balance,
              default: account.isDefault || false,
            }))
          );
        }
        setNewAccountName(""); // Reset input
      } catch (error) {
        console.error("Error adding account:", error);
      }
    }
  };

  // Function to handle setting an account as default
  const handleSetDefault = async (index: number) => {
    if (userEmail) {
      const accountName = accounts[index].name;
      const updatedAccounts = accounts.map((account, i) => ({
        ...account,
        default: i === index,
      }));

      try {
        await updateData(`MealCredits/Update/${userEmail}/${accountName}`, {
          isDefault: true,
        });

        setAccounts(updatedAccounts); // Update the state immediately after setting default
      } catch (error) {
        console.error("Error setting default account:", error);
      }
    }
  };

  // Function to handle deleting an account
  const handleDeleteAccount = async (index: number) => {
    if (userEmail) {
      const accountName = accounts[index].name;

      if (accounts[index].default) {
        alert("Cannot delete the default account.");
        return;
      }

      try {
        await deleteData(`MealCredits/Delete/${userEmail}/${accountName}`);

        const updatedAccounts = accounts.filter((_, i) => i !== index);
        setAccounts(updatedAccounts);
      } catch (error) {
        console.error("Error deleting account:", error);
      }
    }
  };

  // Function to handle transferring money between accounts
  const handleTransferMoney = async (event: React.FormEvent) => {
    event.preventDefault();

    if (fromAccount === toAccount) {
      alert("Cannot transfer money to the same account.");
      return;
    }

    if (fromAccount && toAccount && transferAmount > 0 && userEmail) {
      const fromAccountObj = accounts.find((acc) => acc.name === fromAccount);
      const toAccountObj = accounts.find((acc) => acc.name === toAccount);

      if (
        fromAccountObj &&
        toAccountObj &&
        fromAccountObj.balance >= transferAmount
      ) {
        const transactionDate = new Date().toISOString();
        const updatedAccounts = accounts.map((acc) => {
          if (acc.name === fromAccount) {
            return {
              ...acc,
              balance: acc.balance - transferAmount,
            };
          } else if (acc.name === toAccount) {
            return {
              ...acc,
              balance: acc.balance + transferAmount,
            };
          }
          return acc;
        });

        setAccounts(updatedAccounts);

        try {
          await updateData(`MealCredits/Update/${userEmail}/${fromAccount}`, {
            amount: transferAmount,
            transactionType: "moneyOut",
            date: transactionDate,
          });

          await updateData(`MealCredits/Update/${userEmail}/${toAccount}`, {
            amount: transferAmount,
            transactionType: "moneyIn",
            date: transactionDate,
          });

          setTransferAmount(0);
          setFromAccount("");
          setToAccount("");
        } catch (error) {
          console.error("Error transferring money:", error);
          alert("Error transferring money. Please try again.");
        }
      } else {
        alert("Insufficient funds in the source account or invalid accounts.");
      }
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold">Balance</h2>

      {/* Display list of accounts */}
      <div className="mt-4">
        {accounts.length === 0 ? (
          <p>No accounts available. Add a new account to get started.</p>
        ) : (
          <ul className="space-y-4">
            {accounts.map((account, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-4 bg-gray-100 rounded shadow"
              >
                <span className="font-semibold">{account.name}</span>
                <span className="text-gray-700">
                  {account.balance.toFixed(2)} Kudus
                </span>
                <div className="flex space-x-2">
                  <button
                    className={`text-sm px-2 py-1 rounded ${
                      account.default
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-blue-500"
                    }`}
                    onClick={() => handleSetDefault(index)}
                  >
                    {account.default ? "Default" : "Set as Default"}
                  </button>
                  <button
                    className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                    onClick={() => handleDeleteAccount(index)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Input for adding a new account */}
      <form onSubmit={handleAddAccount} className="mt-6">
        <input
          type="text"
          value={newAccountName}
          onChange={(e) => setNewAccountName(e.target.value)}
          placeholder="New Account Name"
          className="border rounded p-2 mr-2"
        />
        <button type="submit" className="bg-blue-500 text-white rounded px-4 py-2">
          Add Account
        </button>
      </form>

      {/* Transfer Money Section */}
      <form onSubmit={handleTransferMoney} className="mt-6">
        <h3 className="text-xl font-semibold">Transfer Money</h3>
        <input
          type="number"
          value={transferAmount}
          onChange={(e) => setTransferAmount(Number(e.target.value))}
          placeholder="Amount"
          className="border rounded p-2 mr-2"
        />
        <select
          value={fromAccount}
          onChange={(e) => setFromAccount(e.target.value)}
          className="border rounded p-2 mr-2"
        >
          <option value="">From Account</option>
          {accounts.map((account, index) => (
            <option key={index} value={account.name}>
              {account.name}
            </option>
          ))}
        </select>
        <select
          value={toAccount}
          onChange={(e) => setToAccount(e.target.value)}
          className="border rounded p-2 mr-2"
        >
          <option value="">To Account</option>
          {accounts.map((account, index) => (
            <option key={index} value={account.name}>
              {account.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-green-500 text-white rounded px-4 py-2"
        >
          Transfer
        </button>
      </form>
    </div>
  );
};

export default BalanceTab;

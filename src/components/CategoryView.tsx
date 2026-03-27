import AllPasswords from './AllPasswords';
import { Entry, Category } from '../store/useStore';

interface CategoryViewProps {
  entries: Entry[];
  categories: Category[];
  onEdit: (id: string) => void;
}

export default function CategoryView({ entries, categories, onEdit }: CategoryViewProps) {
  return (
    <div className="space-y-6">
      <AllPasswords entries={entries} categories={categories} onEdit={onEdit} />
    </div>
  );
}
